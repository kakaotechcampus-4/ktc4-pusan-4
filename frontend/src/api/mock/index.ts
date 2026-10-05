import type { Api } from '../contract';
import { ApiRequestError } from '../contract';
import type {
  BusinessContext,
  BusinessContextRef,
  ClassificationReview,
  ClassificationReviewGroup,
  EffectiveStatus,
  Judgment,
  JudgmentRun,
  JudgmentRunFailure,
  Page,
  Question,
  QuestionPage,
  Transaction,
  UploadBatch,
  UserInclusion,
  Verdict } from
'../../types/domain';
import {
  CLASSIFICATION_REVIEWS,
  JUDGMENTS,
  JUDGMENT_RUN,
  QUESTION_ANSWER_VERDICT,
  QUESTION_GROUPS,
  QUESTION_TRANSACTIONS,
  TRANSACTIONS,
  UPLOAD_BATCH } from
'./data';
import { STATUTES } from './statutes';

/**
 * 백엔드 준비 전 목업 구현. 응답 모양은 API 명세와 같고,
 * 서버가 하는 일(재판정·Revision·집계)을 인메모리로 흉내 낸다.
 * 새로고침하면 초기화된다.
 */

const LABEL: Record<Verdict, string> = {
  AVAILABLE: '가능',
  UNAVAILABLE: '불가',
  NEEDS_REVIEW: '확인 필요'
};
const STATUS_LABEL: Record<EffectiveStatus, string> = {
  JUDGEABLE: '판정대상',
  CANCELED_OFFSET: '취소상계',
  EXCLUDED: '대상제외'
};

/** 2.3 sourceStatus + userInclusion → effectiveStatus */
const effectiveOf = (t: Transaction): EffectiveStatus => {
  if (t.sourceStatus.code === 'CANCELED_OFFSET') return 'CANCELED_OFFSET';
  if (t.userInclusion === 'EXCLUDED') return 'EXCLUDED';
  if (t.userInclusion === 'INCLUDED') return 'JUDGEABLE';
  return t.sourceStatus.code;
};

const applyInclusion = (t: Transaction, inclusion: UserInclusion): Transaction => {
  t.userInclusion = inclusion;
  const code = effectiveOf(t);
  t.effectiveStatus = { code, label: STATUS_LABEL[code] };
  return t;
};

const LATENCY_MS = 120;
const delay = <T,>(value: T): Promise<T> =>
new Promise((resolve) => window.setTimeout(() => resolve(value), LATENCY_MS));

let seq = 0;
const nextId = (prefix: string) =>
`${prefix}-${String(++seq).padStart(4, '0')}-7000-8000-000000000000`;

const now = () => new Date().toISOString();

const paginate = <T,>(items: T[], page = 0, size = 20): Page<T> => {
  const start = page * size;
  return {
    items: items.slice(start, start + size),
    page: {
      number: page,
      size,
      totalElements: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / size)),
      hasNext: start + size < items.length
    }
  };
};

// ── 상태 ────────────────────────────────────────────

const store = {
  // mockSeedSession 이 "문진을 이미 마쳤다"고 말하므로, 그 문진이 실제로 있어야 한다.
  // 비워 두면 그 세션으로 만든 판정 실행이 CONTEXT_NOT_FOUND 로 막힌다.
  contexts: [
  {
    id: '0199d3a1-0000-7000-8000-000000000001',
    version: 1,
    industryCode: '62010',
    prevYearRevenue: 83_000_000,
    businessOpenDate: '2024-03-01',
    bookkeepingDuty: '복식부기',
    hasEmployee: false,
    homeOfficeRatio: 20
  }] as
  (BusinessContext & BusinessContextRef)[],
  batches: [
  {
    ...UPLOAD_BATCH,
    transactionCount: TRANSACTIONS.length,
    classificationPendingCount: CLASSIFICATION_REVIEWS.filter(
      (r) => r.status.code === 'PENDING'
    ).length
  }] as
  UploadBatch[],
  transactions: TRANSACTIONS.map((t) => ({ ...t })) as Transaction[],
  runs: new Map<string, JudgmentRun>([[JUDGMENT_RUN.id, { ...JUDGMENT_RUN }]]),
  /** 모든 Revision. 최신은 revision 최댓값 */
  judgments: JUDGMENTS.map((j) => ({ ...j })) as Judgment[],
  /** groupKey → 답변 라벨 */
  answers: new Map<string, string>(),
  /** 사용자 수정 이력 (집계 보정용) */
  overrides: [] as { from: Verdict; to: Verdict; amount: number }[],
  reviews: CLASSIFICATION_REVIEWS.map((r) => ({ ...r })) as ClassificationReview[],
  /** 다음 Run 에서 기술적으로 실패시킬 거래 수 (개발용) */
  failNext: 0,
  /** runId → 실패 목록 */
  failures: new Map<string, JudgmentRunFailure[]>()
};

const latestOf = (transactionId: string) =>
store.judgments.
filter((j) => j.transactionId === transactionId).
sort((a, b) => b.revision - a.revision)[0];

const latestAll = () => {
  const seen = new Map<string, Judgment>();
  for (const j of store.judgments) {
    const cur = seen.get(j.transactionId);
    if (!cur || j.revision > cur.revision) seen.set(j.transactionId, j);
  }
  return [...seen.values()];
};

const transactionOf = (id: string) => store.transactions.find((t) => t.id === id);

const ratioOf = (answer: string): number | null =>
/^\d+%$/.test(answer) ? Number(answer.replace('%', '')) : null;

/** 답변 → 새 Revision. 서버 룰엔진이 하는 일을 흉내 낸다. */
const rejudge = (transactionId: string, groupKey: string, answer: string): Judgment => {
  const prev = latestOf(transactionId);
  const verdict = QUESTION_ANSWER_VERDICT[groupKey]?.[answer] ?? 'NEEDS_REVIEW';
  const ratio = ratioOf(answer);
  const amount = transactionOf(transactionId)?.amount ?? 0;
  const next: Judgment = {
    ...prev,
    id: nextId('0199f1c3'),
    revision: prev.revision + 1,
    verdict: { code: verdict, label: LABEL[verdict] },
    blockedAtGate: verdict === 'NEEDS_REVIEW' ? prev.blockedAtGate : null,
    isInference: false,
    unmatchedReason: null,
    attributes: ratio !== null ? { 안분율: ratio } : prev.attributes,
    finalAmount:
    verdict !== 'AVAILABLE' ? null : ratio !== null ? Math.floor(amount * ratio / 100) : amount,
    explanation:
    verdict === 'AVAILABLE' ?
    ratio !== null ?
    `사용자 응답으로 업무 사용 비율 ${ratio}%를 적용해 구분되는 금액만 산입합니다.` :
    '사용자 응답으로 용도가 업무로 확인되어 통상성 게이트를 통과했습니다.' :
    verdict === 'UNAVAILABLE' ?
    '사용자 응답에 따라 개인 목적 지출로 확정되어 필요경비에 산입하지 않습니다.' :
    prev.explanation,
    computedAt: now()
  };
  store.judgments.push(next);
  return next;
};

/** 배치가 지워지면 그 거래에 걸린 질문도 함께 사라진다 (api.md 3.3) */
const liveGroups = () =>
QUESTION_GROUPS.filter((g) =>
(QUESTION_TRANSACTIONS[g.groupKey] ?? []).some((id) =>
store.transactions.some((t) => t.id === id)
)
);

const pendingGroups = (status?: string) => {
  const groups = liveGroups();
  if (status === 'PENDING') return groups.filter((g) => !store.answers.has(g.groupKey));
  if (status === 'ANSWERED') return groups.filter((g) => store.answers.has(g.groupKey));
  return groups;
};

const filterReviews = (status?: string) =>
status ? store.reviews.filter((r) => r.status.code === status) : store.reviews;

/** 페이지네이션과 무관한 미해소 집계 (3.9) */
const withUnresolved = <T,>(page: Page<T>): QuestionPage<T> => {
  const pending = liveGroups().filter((g) => !store.answers.has(g.groupKey));
  return {
    ...page,
    unresolved: {
      count: pending.reduce((sum, g) => sum + g.count, 0),
      amount: pending.reduce((sum, g) => sum + g.totalAmount, 0)
    }
  };
};

const notFound = (code: string, message: string) =>
Promise.reject(new ApiRequestError(404, code, message));

// ── 구현 ────────────────────────────────────────────

export const mockApi: Api = {
  users: {
    me: () =>
    delay({ id: '0199c8f2-user', email: 'dev@example.com', createdAt: '2026-09-01T10:00:00+09:00' }),
    remove: () => delay(undefined)
  },

  contexts: {
    create: (body) => {
      const ref = { id: nextId('0199d3a1'), version: store.contexts.length + 1 };
      store.contexts.push({ ...body, ...ref });
      return delay(ref);
    },
    current: () => delay(store.contexts.at(-1) ?? null),
    list: () => delay([...store.contexts])
  },

  uploads: {
    create: (body) => {
      const batch: UploadBatch = {
        id: nextId('0199c8f2'),
        sourceType: body.sourceType,
        cardIssuer: body.cardIssuer,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        transactionCount: body.transactions.length,
        skippedDuplicateCount: 0,
        classificationPendingCount: store.reviews.filter((r) => r.status.code === 'PENDING').length,
        createdAt: now()
      };
      store.batches.unshift(batch);
      return delay(batch);
    },
    list: (q) => delay(paginate(store.batches, q?.page, q?.size)),
    get: (id) => {
      const b = store.batches.find((x) => x.id === id);
      return b ? delay(b) : notFound('BATCH_NOT_FOUND', '업로드를 찾을 수 없습니다.');
    },
    remove: (id) => {
      if (!store.batches.some((x) => x.id === id))
      return notFound('BATCH_NOT_FOUND', '업로드를 찾을 수 없습니다.');
      // 계약대로 파생 데이터까지 함께 지운다 (api.md 3.3)
      const txIds = new Set(
        store.transactions.filter((t) => t.batchId === id).map((t) => t.id)
      );
      store.batches = store.batches.filter((x) => x.id !== id);
      store.transactions = store.transactions.filter((t) => t.batchId !== id);
      store.judgments = store.judgments.filter((j) => !txIds.has(j.transactionId));
      store.reviews = store.reviews.filter((r) => r.batchId !== id);
      [...store.runs].forEach(([runId, run]) => {
        if (run.batchId === id) {
          store.runs.delete(runId);
          store.failures.delete(runId);
        }
      });
      store.answers.clear();
      store.overrides = [];
      return delay(undefined);
    }
  },

  transactions: {
    list: (q) => {
      let items = store.transactions;
      if (q?.batchId) items = items.filter((t) => t.batchId === q.batchId);
      if (q?.status) items = items.filter((t) => t.effectiveStatus.code === q.status);
      if (q?.classificationStatus)
      items = items.filter((t) => t.classificationStatus.code === q.classificationStatus);
      if (q?.year) items = items.filter((t) => t.approvedAt.startsWith(String(q.year)));
      if (q?.month)
      items = items.filter((t) => Number(t.approvedAt.slice(5, 7)) === q.month);
      if (q?.verdict)
      items = items.filter((t) => latestOf(t.id)?.verdict.code === q.verdict);
      items = [...items].sort((a, b) => b.approvedAt.localeCompare(a.approvedAt) || b.id.localeCompare(a.id));
      return delay(paginate(items, q?.page, q?.size));
    },
    get: (id) => {
      const t = transactionOf(id);
      return t ? delay(t) : notFound('TRANSACTION_NOT_FOUND', '요청한 거래를 찾을 수 없습니다.');
    },
    include: (id) => {
      const t = transactionOf(id);
      if (!t) return notFound('TRANSACTION_NOT_FOUND', '요청한 거래를 찾을 수 없습니다.');
      // 2.3 취소상계는 사용자가 포함으로 바꿀 수 없다
      if (t.sourceStatus.code === 'CANCELED_OFFSET')
      return Promise.reject(
        new ApiRequestError(409, 'CANCELED_TRANSACTION_NOT_INCLUDABLE', '취소·상계 거래는 판정 대상으로 포함할 수 없습니다.')
      );
      return delay(applyInclusion(t, 'INCLUDED'));
    },
    exclude: (id) => {
      const t = transactionOf(id);
      if (!t) return notFound('TRANSACTION_NOT_FOUND', '요청한 거래를 찾을 수 없습니다.');
      return delay(applyInclusion(t, 'EXCLUDED'));
    }
  },

  runs: {
    create: ({ batchId, contextId }) => {
      if (!store.batches.some((b) => b.id === batchId))
      return notFound('BATCH_NOT_FOUND', '업로드를 찾을 수 없습니다.');
      if (!store.contexts.some((c) => c.id === contextId))
      return notFound('CONTEXT_NOT_FOUND', '사업자 문진을 찾을 수 없습니다.');
      // 판정 대상은 JUDGEABLE 이면서 분류가 끝난 거래다. 미분류는 엔진에 넘기지 않는다(api.md 3.3)
      const judgeable = (t: Transaction) =>
      t.batchId === batchId &&
      t.effectiveStatus.code === 'JUDGEABLE' &&
      t.classificationStatus.code === 'CLASSIFIED';
      // 비어 있으면 0 이다. 시드 숫자로 가짜 Run 을 만들지 않는다
      const total = store.transactions.filter(judgeable).length;
      const run: JudgmentRun = {
        id: nextId('0199e5b2'),
        batchId,
        contextId,
        contextVersion: store.contexts.at(-1)?.version ?? 4,
        status: { code: 'QUEUED', label: '대기' },
        totalCount: total,
        processedCount: 0,
        failedCount: 0,
        startedAt: null,
        completedAt: null
      };
      store.runs.set(run.id, run);

      // 기술적 실패 예약이 있으면 이 Run 의 실패 목록을 만든다
      const failCount = Math.min(store.failNext, total);
      store.failNext = 0;
      if (failCount > 0) {
        const targets = store.transactions.filter(judgeable).slice(0, failCount);
        store.failures.set(
          run.id,
          targets.map((t) => ({
            transactionId: t.id,
            errorCode: 'RULE_PROCESSING_FAILED',
            message: '판정 처리 중 오류가 발생했습니다.',
            failedAt: now()
          }))
        );
      }

      // 진행률 흉내: 폴링할 때마다 조금씩 진행
      return delay({
        id: run.id,
        batchId: run.batchId,
        contextId: run.contextId,
        contextVersion: run.contextVersion,
        status: run.status,
        totalCount: run.totalCount
      });
    },
    get: (runId) => {
      const run = store.runs.get(runId);
      if (!run) return notFound('JUDGMENT_RUN_NOT_FOUND', '판정 실행을 찾을 수 없습니다.');
      if (run.status.code === 'QUEUED') {
        run.status = { code: 'RUNNING', label: '실행 중' };
        run.startedAt = now();
      } else if (run.status.code === 'RUNNING') {
        const failed = store.failures.get(run.id)?.length ?? 0;
        const succeedable = run.totalCount - failed;
        run.processedCount = Math.min(
          succeedable,
          run.processedCount + Math.ceil(run.totalCount / 8)
        );
        if (run.processedCount >= succeedable) {
          run.failedCount = failed;
          run.status =
          failed === 0 ?
          { code: 'COMPLETED', label: '완료' } :
          failed >= run.totalCount ?
          { code: 'FAILED', label: '전체 실패' } :
          { code: 'PARTIAL_FAILED', label: '부분 실패' };
          run.completedAt = now();
        }
      }
      return delay({ ...run });
    },
    failures: (runId, q) => {
      const run = store.runs.get(runId);
      if (!run) return notFound('JUDGMENT_RUN_NOT_FOUND', '판정 실행을 찾을 수 없습니다.');
      // NEEDS_REVIEW 는 실패가 아니다. 기술적 실패만 여기 온다
      return delay(paginate(store.failures.get(runId) ?? [], q?.page, q?.size));
    }
  },

  judgments: {
    summary: (scope) => {
      // 스코프는 batchId·year·runId 중 정확히 하나다 (api.md 3.7)
      const given = [scope.batchId, scope.year, scope.runId].filter(
        (v) => v !== undefined && v !== null
      );
      if (given.length !== 1)
      return Promise.reject(
        new ApiRequestError(400, 'INVALID_SUMMARY_SCOPE', 'batchId·year·runId 중 하나만 지정해야 합니다.')
      );
      const type = scope.batchId ? 'BATCH' : scope.year ? 'YEAR' : 'RUN';
      const id = String(scope.batchId ?? scope.year ?? scope.runId);

      /**
       * 실제 판정에서 계산한다. 전에는 292건 규모의 고정값에 답변·수정 이동만
       * 더했는데, 거래 시드는 31건이라 /uploads·/transactions 와 숫자가 어긋났다.
       */
      const batchOfScope =
      scope.batchId ??
      (scope.runId ? store.runs.get(scope.runId)?.batchId : undefined);
      const rows = latestAll().filter((j) => {
        const t = transactionOf(j.transactionId);
        if (!t) return false;
        // 사용자가 지금 제외한 거래는 집계하지 않는다 (api.md 3.7)
        if (t.effectiveStatus.code !== 'JUDGEABLE') return false;
        if (batchOfScope && t.batchId !== batchOfScope) return false;
        if (scope.year && !t.approvedAt.startsWith(String(scope.year))) return false;
        return true;
      });

      const by: Record<Verdict, { count: number; finalAmount: number }> = {
        AVAILABLE: { count: 0, finalAmount: 0 },
        UNAVAILABLE: { count: 0, finalAmount: 0 },
        NEEDS_REVIEW: { count: 0, finalAmount: 0 }
      };
      const accounts = new Map<string, { count: number; finalAmount: number }>();
      for (const j of rows) {
        const slot = by[j.verdict.code];
        slot.count += 1;
        slot.finalAmount += j.finalAmount ?? 0;
        if (j.verdict.code !== 'AVAILABLE' || !j.account) continue;
        const acc = accounts.get(j.account) ?? { count: 0, finalAmount: 0 };
        acc.count += 1;
        acc.finalAmount += j.finalAmount ?? 0;
        accounts.set(j.account, acc);
      }

      return delay({
        scope: { type, id },
        totalCount: rows.length,
        byVerdict: by,
        byAccount: [...accounts].
        map(([account, v]) => ({ account, ...v })).
        sort((a, b) => b.finalAmount - a.finalAmount)
      });
    },
    list: (q) => {
      // transactionId 지정은 이력 전체, 그 외는 거래별 현재 판정
      let items = q?.transactionId ?
      store.judgments.filter((j) => j.transactionId === q.transactionId) :
      latestAll();
      if (q?.verdict) items = items.filter((j) => j.verdict.code === q.verdict);
      if (q?.batchId)
      items = items.filter((j) => transactionOf(j.transactionId)?.batchId === q.batchId);
      // 이력 조회(transactionId 지정)가 아니면 지금 제외된 거래는 빼낸다 (api.md 3.7)
      if (!q?.transactionId)
      items = items.filter(
        (j) => transactionOf(j.transactionId)?.effectiveStatus.code === 'JUDGEABLE'
      );
      items.sort((a, b) => b.computedAt.localeCompare(a.computedAt) || b.id.localeCompare(a.id));
      return delay(paginate(items, q?.page, q?.size ?? 20));
    },
    get: (id) => {
      const j = store.judgments.find((x) => x.id === id);
      return j ? delay(j) : notFound('JUDGMENT_NOT_FOUND', '판정을 찾을 수 없습니다.');
    },
    override: (id, body) => {
      const prev = store.judgments.find((x) => x.id === id);
      if (!prev) return notFound('JUDGMENT_NOT_FOUND', '판정을 찾을 수 없습니다.');
      const amount = transactionOf(prev.transactionId)?.amount ?? null;
      const next: Judgment = {
        ...prev,
        id: nextId('0199f1c3'),
        revision: latestOf(prev.transactionId).revision + 1,
        verdict: { code: body.toVerdict, label: LABEL[body.toVerdict] },
        finalAmount: body.toVerdict === 'AVAILABLE' ? prev.finalAmount ?? amount : null,
        explanation: `사용자 수정: ${body.reason}`,
        computedAt: now()
      };
      store.judgments.push(next);
      store.overrides.push({
        from: prev.verdict.code,
        to: body.toVerdict,
        amount: next.finalAmount ?? prev.finalAmount ?? 0
      });
      return delay(next);
    },
    removeOverride: (overrideId) => {
      // 목업은 마지막 수정을 되돌린다
      void overrideId;
      store.overrides.pop();
      return delay(undefined);
    }
  },

  statutes: {
    get: (versionId) => {
      const s = STATUTES.find((x) => x.statuteVersionId === versionId);
      return s ? delay(s) : notFound('STATUTE_NOT_FOUND', '조문을 찾을 수 없습니다.');
    }
  },

  questions: {
    list: (q) => {
      const groups = pendingGroups(q?.status);
      const items: Question[] = groups.flatMap((g) =>
      g.questionIds.map((id, index) => ({
        id,
        transactionId: (QUESTION_TRANSACTIONS[g.groupKey] ?? [])[index] ?? '',
        factType: g.factType,
        status: store.answers.has(g.groupKey) ?
        { code: 'ANSWERED' as const, label: '응답' } :
        { code: 'PENDING' as const, label: '대기' },
        questionText: g.questionText,
        options: [...g.options],
        createdAt: '2026-09-12T14:05:00+09:00'
      }))
      );
      return delay(withUnresolved(paginate(items, q?.page, q?.size ?? 20)));
    },
    grouped: (q) =>
    delay(withUnresolved(paginate(pendingGroups(q?.status), q?.page, q?.size ?? 20))),
    respond: ({ questionIds, answer }) => {
      // 살아 있는 그룹에서 찾는다. 배치를 지운 뒤에는 404 여야 한다 (정적 배열을 보면 TypeError 가 난다)
      const group = liveGroups().find((g) => g.questionIds.some((id) => questionIds.includes(id)));
      if (!group) return notFound('QUESTION_NOT_FOUND', '질문을 찾을 수 없습니다.');
      if (!group.options.includes(answer.value))
      return Promise.reject(new ApiRequestError(422, 'INVALID_ANSWER_VALUE', '선택지에 없는 값입니다.'));
      store.answers.set(group.groupKey, answer.value);
      const rejudged = QUESTION_TRANSACTIONS[group.groupKey] ?? [];
      rejudged.forEach((tid) => rejudge(tid, group.groupKey, answer.value));
      // 명세 3.10: 새 JudgmentRun 은 만들지 않는다. runId 는 응답에서 제거됐다
      return delay({
        answeredCount: group.count,
        factId: `fact-${group.groupKey}`,
        rejudgedTransactionCount: rejudged.length
      });
    },
    bulkAnswer: ({ factType, answer }) => {
      // factType 이 같은 PENDING 질문을 한 번에 닫는다. 새 Run 은 만들지 않는다
      const targets = QUESTION_GROUPS.filter(
        (g) => g.factType === factType && !store.answers.has(g.groupKey)
      );
      const allowed = targets.filter((g) => g.options.includes(answer.value));
      if (targets.length > 0 && allowed.length !== targets.length)
      return Promise.reject(
        new ApiRequestError(422, 'INVALID_ANSWER_VALUE', '모든 대상 질문이 허용하는 값이 아닙니다.')
      );
      let answered = 0;
      const rejudged = new Set<string>();
      allowed.forEach((group) => {
        store.answers.set(group.groupKey, answer.value);
        (QUESTION_TRANSACTIONS[group.groupKey] ?? []).forEach((tid) => {
          rejudge(tid, group.groupKey, answer.value);
          rejudged.add(tid);
        });
        answered += group.count;
      });
      const pending = liveGroups().filter((g) => !store.answers.has(g.groupKey));
      return delay({
        answeredCount: answered,
        skippedCount: targets.length - allowed.length,
        factIds: allowed.map((g) => `fact-${g.groupKey}`),
        rejudgedTransactionCount: rejudged.size,
        unresolved: {
          count: pending.reduce((sum, g) => sum + g.count, 0),
          amount: pending.reduce((sum, g) => sum + g.totalAmount, 0)
        }
      });
    }
  },

  classificationReviews: {
    list: (q) => delay(paginate(filterReviews(q?.status), q?.page, q?.size ?? 20)),
    grouped: (q) => {
      // 서버는 카드사 트랙(사업자번호/문자열)까지 섞어 묶으므로 같은 merchantNorm 이
      // 다른 그룹으로 갈릴 수 있다. 목업도 그 상황을 만들어 둔다 (#63 리뷰).
      const byMerchant = new Map<string, ClassificationReview[]>();
      filterReviews(q?.status).forEach((r) => {
        const track = r.merchantRaw.startsWith('PADDLE.NET* CURSOR') ? ':bizno' : '';
        const key = `merchant:${r.merchantNorm}${track}`;
        byMerchant.set(key, [...(byMerchant.get(key) ?? []), r]);
      });
      const items: ClassificationReviewGroup[] = [...byMerchant].map(([groupKey, rows]) => ({
        groupKey,
        reviewIds: rows.map((r) => r.id),
        count: rows.length,
        totalAmount: rows.reduce((sum, r) => sum + (transactionOf(r.transactionId)?.amount ?? 0), 0),
        merchantRaw: rows[0].merchantRaw,
        suggestedCategories: rows[0].suggestedCategories
      }));
      return delay(paginate(items, q?.page, q?.size ?? 20));
    },
    respond: ({ reviewIds, merchantCategory }) => {
      if (merchantCategory === '미분류')
      return Promise.reject(
        new ApiRequestError(422, 'UNCLASSIFIED_CATEGORY_NOT_ALLOWED', '「미분류」는 답변으로 제출할 수 없습니다.')
      );
      const rows = store.reviews.filter((r) => reviewIds.includes(r.id));
      if (rows.length === 0)
      return notFound('CLASSIFICATION_REVIEW_NOT_FOUND', '분류 확인 항목을 찾을 수 없습니다.');
      if (new Set(rows.map((r) => r.batchId)).size > 1)
      return Promise.reject(
        new ApiRequestError(422, 'REVIEWS_FROM_DIFFERENT_BATCHES', '서로 다른 배치의 항목은 함께 답할 수 없습니다.')
      );
      if (rows.some((r) => r.status.code === 'RESOLVED'))
      return Promise.reject(
        new ApiRequestError(409, 'CLASSIFICATION_ALREADY_RESOLVED', '이미 해결된 항목입니다.')
      );
      rows.forEach((r) => {
        r.status = { code: 'RESOLVED', label: '해결' };
        r.resolvedAt = now();
        const t = transactionOf(r.transactionId);
        if (t) {
          t.merchantCategory = merchantCategory;
          t.classificationStatus = { code: 'CLASSIFIED', label: '분류 완료' };
        }
      });
      // 완료된 Run 이 있으면 해결된 거래만 재판정한다 (origin = CLASSIFICATION_REVIEW)
      const hasCompletedRun = [...store.runs.values()].some((r) => r.status.code === 'COMPLETED');
      return delay({
        resolvedCount: rows.length,
        merchantCategory,
        judgedCount: hasCompletedRun ? rows.length : 0
      });
    }
  }
};

/**
 * 목업 전용 — 흐름을 거치지 않고 화면에 바로 들어와도 보이도록 세션 초기값을 준다.
 * http 구현에서는 null. 화면 코드가 이 값을 직접 알면 안 된다.
 */
/**
 * 개발용 스위치. 실패 화면을 보려면 콘솔에서:
 *   (await import('/src/api/index.ts')).mockControls.failNextRun(2)
 * 그다음 판정을 실행하면 그 Run 이 부분 실패로 끝난다.
 */
export const mockControls = {
  failNextRun(count: number) {
    store.failNext = Math.max(0, count);
  }
};

export const mockSeedSession = {
  batchId: UPLOAD_BATCH.id,
  contextRef: { id: '0199d3a1-0000-7000-8000-000000000001', version: 1 },
  runId: JUDGMENT_RUN.id
};
