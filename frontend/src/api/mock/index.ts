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
  JUDGMENT_SUMMARY,
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
  contexts: [] as (BusinessContext & BusinessContextRef)[],
  batches: [UPLOAD_BATCH] as UploadBatch[],
  transactions: TRANSACTIONS.map((t) => ({ ...t })) as Transaction[],
  runs: new Map<string, JudgmentRun>([[JUDGMENT_RUN.id, { ...JUDGMENT_RUN }]]),
  /** 모든 Revision. 최신은 revision 최댓값 */
  judgments: JUDGMENTS.map((j) => ({ ...j })) as Judgment[],
  /** groupKey → 답변 라벨 */
  answers: new Map<string, string>(),
  /** 사용자 수정 이력 (집계 보정용) */
  overrides: [] as { from: Verdict; to: Verdict; amount: number }[],
  reviews: CLASSIFICATION_REVIEWS.map((r) => ({ ...r })) as ClassificationReview[]
};

const GROUP_OF_TRANSACTION: Record<string, string> = Object.fromEntries(
  Object.entries(QUESTION_TRANSACTIONS).flatMap(([g, ids]) => ids.map((id) => [id, g]))
);

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

const pendingGroups = (status?: string) => {
  if (status === 'PENDING') return QUESTION_GROUPS.filter((g) => !store.answers.has(g.groupKey));
  if (status === 'ANSWERED') return QUESTION_GROUPS.filter((g) => store.answers.has(g.groupKey));
  return QUESTION_GROUPS;
};

const filterReviews = (status?: string) =>
status ? store.reviews.filter((r) => r.status.code === status) : store.reviews;

/** 페이지네이션과 무관한 미해소 집계 (3.9) */
const withUnresolved = <T,>(page: Page<T>): QuestionPage<T> => {
  const pending = QUESTION_GROUPS.filter((g) => !store.answers.has(g.groupKey));
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
      return b ? delay(b) : notFound('UPLOAD_BATCH_NOT_FOUND', '업로드를 찾을 수 없습니다.');
    },
    remove: (id) => {
      store.batches = store.batches.filter((x) => x.id !== id);
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
    create: ({ batchId }) => {
      const total =
      store.transactions.filter((t) => t.batchId === batchId && t.effectiveStatus.code === 'JUDGEABLE').length ||
      JUDGMENT_RUN.totalCount;
      const run: JudgmentRun = {
        id: nextId('0199e5b2'),
        status: { code: 'QUEUED', label: '대기' },
        totalCount: total,
        processedCount: 0,
        failedCount: 0,
        startedAt: null,
        completedAt: null
      };
      store.runs.set(run.id, run);
      // 진행률 흉내: 폴링할 때마다 조금씩 진행
      return delay({ id: run.id, status: run.status, totalCount: run.totalCount });
    },
    get: (runId) => {
      const run = store.runs.get(runId);
      if (!run) return notFound('JUDGMENT_RUN_NOT_FOUND', '판정 실행을 찾을 수 없습니다.');
      if (run.status.code === 'QUEUED') {
        run.status = { code: 'RUNNING', label: '진행' };
        run.startedAt = now();
      } else if (run.status.code === 'RUNNING') {
        run.processedCount = Math.min(run.totalCount, run.processedCount + Math.ceil(run.totalCount / 8));
        if (run.processedCount >= run.totalCount) {
          run.status = { code: 'COMPLETED', label: '완료' };
          run.completedAt = now();
        }
      }
      return delay({ ...run });
    },
    failures: (runId, q) => {
      const run = store.runs.get(runId);
      if (!run) return notFound('JUDGMENT_RUN_NOT_FOUND', '판정 실행을 찾을 수 없습니다.');
      // 목업에서는 기술적 실패를 만들지 않는다. NEEDS_REVIEW 는 실패가 아니다
      return delay(paginate([], q?.page, q?.size));
    }
  },

  judgments: {
    summary: (scope) => {
      // 목업 데이터는 292건 중 24건 샘플이라, 집계는 기준값에 답변·수정으로 생긴 이동만 더한다
      const by: Record<Verdict, { count: number; finalAmount: number }> = {
        AVAILABLE: { ...JUDGMENT_SUMMARY.byVerdict.AVAILABLE },
        UNAVAILABLE: { ...JUDGMENT_SUMMARY.byVerdict.UNAVAILABLE },
        NEEDS_REVIEW: { ...JUDGMENT_SUMMARY.byVerdict.NEEDS_REVIEW }
      };
      for (const group of QUESTION_GROUPS) {
        const answer = store.answers.get(group.groupKey);
        if (!answer) continue;
        const verdict = QUESTION_ANSWER_VERDICT[group.groupKey]?.[answer];
        if (!verdict || verdict === 'NEEDS_REVIEW') continue;
        by.NEEDS_REVIEW.count -= group.count;
        by[verdict].count += group.count;
        if (verdict === 'AVAILABLE') {
          const ratio = ratioOf(answer);
          by.AVAILABLE.finalAmount += ratio !== null ? Math.floor(group.totalAmount * ratio / 100) : group.totalAmount;
        }
      }
      for (const o of store.overrides) {
        by[o.from].count -= 1;
        by[o.to].count += 1;
        if (o.from === 'AVAILABLE') by.AVAILABLE.finalAmount -= o.amount;
        if (o.to === 'AVAILABLE') by.AVAILABLE.finalAmount += o.amount;
      }
      const type = scope.batchId ? 'BATCH' : scope.year ? 'YEAR' : 'RUN';
      const id = String(scope.batchId ?? scope.year ?? scope.runId);
      return delay({ ...JUDGMENT_SUMMARY, scope: { type, id }, byVerdict: by });
    },
    list: (q) => {
      // transactionId 지정은 이력 전체, 그 외는 거래별 현재 판정
      let items = q?.transactionId ?
      store.judgments.filter((j) => j.transactionId === q.transactionId) :
      latestAll();
      if (q?.verdict) items = items.filter((j) => j.verdict.code === q.verdict);
      if (q?.batchId)
      items = items.filter((j) => transactionOf(j.transactionId)?.batchId === q.batchId);
      items.sort((a, b) => b.computedAt.localeCompare(a.computedAt) || b.id.localeCompare(a.id));
      return delay(paginate(items, q?.page, q?.size ?? 100));
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
      return delay(withUnresolved(paginate(items, q?.page, q?.size ?? 100)));
    },
    grouped: (q) =>
    delay(withUnresolved(paginate(pendingGroups(q?.status), q?.page, q?.size ?? 100))),
    respond: ({ questionIds, answer }) => {
      const group = QUESTION_GROUPS.find((g) => g.questionIds.some((id) => questionIds.includes(id)));
      if (!group) return notFound('QUESTION_NOT_FOUND', '질문을 찾을 수 없습니다.');
      if (!group.options.includes(answer.value))
      return Promise.reject(new ApiRequestError(422, 'INVALID_ANSWER_VALUE', '선택지에 없는 값입니다.'));
      store.answers.set(group.groupKey, answer.value);
      (QUESTION_TRANSACTIONS[group.groupKey] ?? []).forEach((tid) =>
      rejudge(tid, group.groupKey, answer.value)
      );
      const run: JudgmentRun = {
        id: nextId('0199g7d4'),
        status: { code: 'COMPLETED', label: '완료' },
        totalCount: group.count,
        processedCount: group.count,
        failedCount: 0,
        startedAt: now(),
        completedAt: now()
      };
      store.runs.set(run.id, run);
      return delay({ answeredCount: group.count, runId: run.id });
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
      allowed.forEach((group) => {
        store.answers.set(group.groupKey, answer.value);
        (QUESTION_TRANSACTIONS[group.groupKey] ?? []).forEach((tid) =>
        rejudge(tid, group.groupKey, answer.value)
        );
        answered += group.count;
      });
      return delay({
        answeredCount: answered,
        skippedCount: 0,
        factIds: allowed.map((g) => `fact-${g.groupKey}`)
      });
    }
  },

  classificationReviews: {
    list: (q) => delay(paginate(filterReviews(q?.status), q?.page, q?.size ?? 100)),
    grouped: (q) => {
      const byMerchant = new Map<string, ClassificationReview[]>();
      filterReviews(q?.status).forEach((r) => {
        const key = `merchant:${r.merchantNorm}`;
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
      return delay(paginate(items, q?.page, q?.size ?? 100));
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
export const mockSeedSession = {
  batchId: UPLOAD_BATCH.id,
  contextRef: { id: '0199d3a1-0000-7000-8000-000000000001', version: 1 },
  runId: JUDGMENT_RUN.id
};
