import type { Api } from '../contract';
import { ApiRequestError } from '../contract';
import type {
  AssistantChatRequest,
  AssistantChatResponse,
  AssistantProposal,
  ClassificationReview,
  ClassificationReviewGroup,
  EffectiveStatus,
  HandoffNote,
  Judgment,
  JudgmentRun,
  JudgmentRunFailure,
  Page,
  Question,
  QuestionGroup,
  QuestionPage,
  RuleCandidate,
  StoredBusinessContext,
  UnresolvedPage,
  Transaction,
  TransactionInclusion,
  TransactionSummary,
  UploadBatch,
  UserInclusion,
  Verdict } from
'../../types/domain';
import { MERCHANT_CATEGORIES, UNCLASSIFIED } from '../../types/domain';
import type { JudgmentSeed, QuestionGroupSeed } from './data';
import {
  CLASSIFICATION_REVIEWS,
  JUDGMENTS,
  JUDGMENT_RUN,
  QUESTION_ANSWER_VERDICT,
  QUESTION_CARDS,
  QUESTION_GROUPS,
  QUESTION_SUGGESTIONS,
  QUESTION_TRANSACTIONS,
  RULE_CANDIDATES,
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

/**
 * 가맹점 이름 → 업종. 서버는 PG·개인 사전·전역 사전·키워드룰을 차례로 보지만(#124),
 * 목업은 키워드 몇 개만 본다. 못 맞히면 분류 확인으로 넘긴다 — 그래야 업로드한 뒤
 * 「분류하지 못한 거래」 흐름이 목업에서도 그대로 이어진다
 */
const MERCHANT_KEYWORDS: [RegExp, string, string][] = [
[/AWS|AMAZON WEB/i, 'Amazon Web Services', '해외SaaS'],
[/GITHUB/i, 'GitHub', '해외SaaS'],
[/NOTION|FIGMA|SLACK|OPENAI|ANTHROPIC/i, '해외 SaaS', '해외SaaS'],
[/NETFLIX|넷플릭스/i, 'Netflix', '구독서비스'],
[/쿠팡|COUPANG|11번가|지마켓/i, '쿠팡', '온라인쇼핑'],
[/지하철|버스|택시/, '대중교통', '여비교통'],
[/하이마트|전자랜드|애플스토어/i, '하이마트', '전자기기'],
[/스타벅스|STARBUCKS|이디야|투썸/i, '카페', '카페'],
[/GS25|CU|세븐일레븐|이마트24/i, '편의점', '편의점'],
[/KTX|코레일|한국철도/i, '한국철도공사', '여비교통'],
[/SK에너지|GS칼텍스|현대오일|주유/i, '주유소', '차량'],
[/KT|SKT|LG유플러스|통신/i, '통신사', '통신'],
[/교보문고|YES24|알라딘|서점/i, '서점', '도서']];


/** 시드 판정이 쓴 규칙 커밋. 새로 만드는 판정도 같은 값을 쓴다 */
const RULES_SHA = JUDGMENTS[0]?.rulesCommitSha ?? '';

/** 분류 확인 화면이 먼저 보여줄 선택지. 서버는 후보를 계산하지만 목업은 고정이다 */
const SUGGESTED_CATEGORIES = ['해외SaaS', '사무용품', '기타'] as const;

/** 못 맞히면 category 가 null 이다 */
const guessMerchant = (raw: string) => {
  const hit = MERCHANT_KEYWORDS.find(([pattern]) => pattern.test(raw));
  return hit ?
  { merchantNorm: hit[1], category: hit[2] } :
  { merchantNorm: raw.trim(), category: null };
};

/**
 * 분류를 확인한 거래의 판정. 목업은 규칙 엔진을 돌릴 수 없어 업종으로 가른다.
 * 목록에 없는 업종은 단정하지 않고 확인 필요로 둔다
 */
const VERDICT_BY_CATEGORY: Record<string, Verdict> = {
  해외SaaS: 'AVAILABLE',
  국내SW: 'AVAILABLE',
  통신: 'AVAILABLE',
  사무용품: 'AVAILABLE',
  여비교통: 'AVAILABLE',
  광고: 'AVAILABLE',
  전문가수수료: 'AVAILABLE',
  임차료: 'AVAILABLE',
  지자체_과태료: 'UNAVAILABLE',
  경찰청_범칙금: 'UNAVAILABLE',
  조세: 'UNAVAILABLE',
  의료: 'UNAVAILABLE',
  미용: 'UNAVAILABLE'
};

/** include·exclude 응답은 바뀐 상태만 담는다 (3.4) */
const applyInclusion = (t: Transaction, inclusion: UserInclusion): TransactionInclusion => {
  t.userInclusion = inclusion;
  const code = effectiveOf(t);
  t.effectiveStatus = { code, label: STATUS_LABEL[code] };
  return { id: t.id, userInclusion: t.userInclusion, effectiveStatus: t.effectiveStatus };
};

const LATENCY_MS = 120;
const delay = <T,>(value: T): Promise<T> =>
new Promise((resolve) => window.setTimeout(() => resolve(value), LATENCY_MS));

let seq = 0;
const nextId = (prefix: string) =>
`${prefix}-${String(++seq).padStart(4, '0')}-7000-8000-000000000000`;

const now = () => new Date().toISOString();

const USER_ID = '0199c8f2-user';

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
    // 시드 판정·Run 이 문진 v4 로 만들어졌으므로 버전을 맞춘다
    id: '0199d3a1-0000-7000-8000-000000000001',
    version: 4,
    industryCode: '62010',
    prevYearRevenue: 83_000_000,
    businessOpenDate: '2024-03-01',
    bookkeepingDuty: '복식부기',
    hasEmployee: false,
    homeOfficeRatio: 20,
    userId: USER_ID,
    createdAt: '2026-09-01T10:00:00+09:00'
  }] as
  StoredBusinessContext[],
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
  /** 모든 Revision. 최신은 revision 최댓값. 거래 요약은 읽을 때 붙인다 (withTransaction) */
  judgments: JUDGMENTS.map((j) => ({ ...j })) as JudgmentSeed[],
  /** groupKey → 답변 라벨과 답한 시각. 같은 그룹에 다시 답하면 정정이다 (3.10) */
  answers: new Map<string, { value: string; at: string }>(),
  /** groupKey → UserFact version. 정정할 때마다 올라간다 */
  factVersions: new Map<string, number>(),
  /** overrideId → JudgmentOverride. 해제해도 지우지 않고 active 만 끈다 (api.md 3.8) */
  overrides: new Map<string, { transactionId: string; judgmentId: string; active: boolean }>(),
  reviews: CLASSIFICATION_REVIEWS.map((r) => ({ ...r })) as ClassificationReview[],
  /** 다음 Run 에서 기술적으로 실패시킬 거래 수와 그 실패 코드 (개발용) */
  failNext: 0,
  failNextCode: 'RULE_PROCESSING_FAILED',
  /** runId → 실패 목록 */
  failures: new Map<string, JudgmentRunFailure[]>(),
  /** 다음 업로드를 이 오류로 실패시킨다 (개발용) */
  failUpload: null as ApiRequestError | null,
  /** 로그인한 이메일. 로그아웃하면 null 이고, 그때 users.me 는 401 이다 */
  email: null as string | null,
  ruleCandidates: RULE_CANDIDATES.map((c) => ({ ...c })) as RuleCandidate[],
  /** 다음 비서 요청을 이 오류로 실패시킨다 (개발용) */
  failAssistant: null as ApiRequestError | null,
  handoffNotes: [] as HandoffNote[]
};

/**
 * 목업 비밀번호. 이메일은 무엇이든 받고 비밀번호만 본다. 실서버 로컬 프로필의 고정 사용자 비밀번호와 같다(#155).
 * 로그인 화면의 목업 전용 버튼과 안내도 이 값을 쓴다(Login.tsx)
 */
export const MOCK_PASSWORD = 'demo1234';

/** 목업에서 관리자 화면을 보려면 admin@… 으로 로그인한다 */
const isAdminEmail = (email: string | null) => email?.split('@')[0] === 'admin';

const latestOf = (transactionId: string) =>
store.judgments.
filter((j) => j.transactionId === transactionId).
sort((a, b) => b.revision - a.revision)[0];

/**
 * 거래의 현재 판정 (api.md 3.7). 활성 Override 가 있으면 그 revision 이고,
 * 없으면 Override 가 아닌 revision 중 최신이다. 그래서 수정 뒤에 답변으로 새 revision 이
 * 생겨도 현재 결과는 수정한 값으로 남는다.
 */
const currentOf = (transactionId: string): JudgmentSeed | undefined => {
  const active = [...store.overrides.values()].find(
    (o) => o.active && o.transactionId === transactionId
  );
  if (active) return store.judgments.find((j) => j.id === active.judgmentId);
  return store.judgments.
  filter((j) => j.transactionId === transactionId && j.origin.type !== 'OVERRIDE').
  sort((a, b) => b.revision - a.revision)[0];
};

const currentAll = () =>
[...new Set(store.judgments.map((j) => j.transactionId))].
map(currentOf).
filter((j): j is JudgmentSeed => j !== undefined);

/** Override 를 뺀 최신 자동 판정. 엔진은 이 위에서 다시 판정한다 */
const automaticOf = (transactionId: string): JudgmentSeed | undefined =>
store.judgments.
filter((j) => j.transactionId === transactionId && j.origin.type !== 'OVERRIDE').
sort((a, b) => b.revision - a.revision)[0];

const hasActiveOverride = (transactionId: string) =>
[...store.overrides.values()].some((o) => o.active && o.transactionId === transactionId);

/** 그 Run 이 직접 만든 판정. 이후 답변·수정으로 생긴 revision 은 포함하지 않는다 */
const producedBy = (runId: string) =>
store.judgments.filter((j) => j.origin.type === 'RUN' && j.origin.id === runId);

const transactionOf = (id: string) => store.transactions.find((t) => t.id === id);

const summaryOf = (t: Transaction): TransactionSummary => ({
  approvedAt: t.approvedAt,
  merchantRaw: t.merchantRaw,
  merchantNorm: t.merchantNorm,
  merchantCategory: t.merchantCategory,
  amount: t.amount,
  installmentMonths: t.installmentMonths
});

/** 판정에 거래 요약을 붙인다. 판정 당시가 아니라 응답 시점의 거래 값이다 (3.4 거래 요약) */
const withTransaction = (j: JudgmentSeed): Judgment | null => {
  const t = transactionOf(j.transactionId);
  return t ? { ...j, transaction: summaryOf(t) } : null;
};

/** §5 판정 대상: 판정대상이면서 분류가 끝난 거래 */
const isJudgeable = (t: Transaction) =>
t.effectiveStatus.code === 'JUDGEABLE' && t.classificationStatus.code === 'CLASSIFIED';

const ratioOf = (answer: string): number | null =>
/^\d+%$/.test(answer) ? Number(answer.replace('%', '')) : null;

/** 그 질문 그룹의 지금 UserFact id. 정정할 때마다 version 이 올라간다 (3.10) */
const factIdOf = (groupKey: string) =>
`fact-${groupKey}-v${store.factVersions.get(groupKey) ?? 1}`;

const citationsOf = (ids: number[]) =>
ids.map((statuteVersionId) => ({
  statuteVersionId,
  statuteId: STATUTES.find((x) => x.statuteVersionId === statuteVersionId)?.statuteId ?? ''
}));

/** 답변 → 새 Revision. 서버 룰엔진이 하는 일을 흉내 낸다. */
const rejudge = (transactionId: string, groupKey: string, answer: string) => {
  // 엔진은 사용자 수정이 아니라 자기 판정 위에서 다시 판정한다
  const prev = automaticOf(transactionId);
  if (!prev) return;
  const verdict = QUESTION_ANSWER_VERDICT[groupKey]?.[answer] ?? 'NEEDS_REVIEW';
  // 질문을 낸 카드의 선택지대로 규칙 카드·계정과목·근거를 붙인다
  const card = QUESTION_CARDS[groupKey];
  const option = card?.options[answer];
  const ratio = ratioOf(answer);
  const amount = transactionOf(transactionId)?.amount ?? 0;
  const next: JudgmentSeed = {
    ...prev,
    id: nextId('0199f1c3'),
    revision: latestOf(transactionId).revision + 1,
    origin: { type: 'USER_FACT', id: factIdOf(groupKey) },
    verdict: { code: verdict, label: LABEL[verdict] },
    ruleCardId: card?.ruleCardId ?? prev.ruleCardId,
    ruleCardVersion: card?.ruleCardVersion ?? prev.ruleCardVersion,
    appliedRuleIds: card ? [card.ruleCardId] : prev.appliedRuleIds,
    // 불가는 필요경비가 아니라 계정과목을 붙이지 않는다. 카드가 계정과목을 주지 않는 답이면 비운다
    // (예전 답이나 시드 카드의 계정과목이 남으면 같은 답이라도 결과가 달라진다)
    account: verdict === 'UNAVAILABLE' ? null : card ? option?.account ?? null : prev.account,
    citations: card ? citationsOf(option?.citations ?? card.citations) : prev.citations,
    blockedAtGate: verdict === 'NEEDS_REVIEW' ? prev.blockedAtGate : null,
    isInference: false,
    unmatchedReason: null,
    attributes:
    ratio !== null ? { 안분율: ratio } : card ? { ...(option?.attributes ?? {}) } : prev.attributes,
    finalAmount:
    verdict !== 'AVAILABLE' ? null : ratio !== null ? Math.floor(amount * ratio / 100) : amount,
    explanation:
    verdict === 'AVAILABLE' ?
    ratio !== null ?
    `사용자 응답으로 업무 사용 비율 ${ratio}%를 적용해 구분되는 금액만 산입합니다.` :
    '사용자 응답을 반영해 카드의 선택지대로 필요경비로 판정했습니다.' :
    verdict === 'UNAVAILABLE' ?
    '사용자 응답에 따라 개인 목적 지출로 확정되어 필요경비에 산입하지 않습니다.' :
    '사용자 응답을 반영했습니다. 다음 관문에서 정할 조건이 남아 확인 필요로 둡니다.',
    computedAt: now()
  };
  store.judgments.push(next);
};

/**
 * Run 이 끝나면 처리에 성공한 거래마다 새 revision 을 남긴다 (api.md 3.6, 8.6).
 * 목업 엔진은 새로 판정하지 못하므로, Override 가 아닌 최신 revision 을 이 Run 의 결과로 다시 적는다.
 * 활성 Override 는 그대로 현재 결과로 남는다 (3.8).
 */
const judgeRun = (run: JudgmentRun) => {
  const failed = new Set((store.failures.get(run.id) ?? []).map((f) => f.transactionId));
  store.transactions.
  filter((t) =>
  t.batchId === run.batchId &&
  t.effectiveStatus.code === 'JUDGEABLE' &&
  t.classificationStatus.code === 'CLASSIFIED' &&
  !failed.has(t.id)
  ).
  forEach((t) => {
    const prev = store.judgments.
    filter((j) => j.transactionId === t.id && j.origin.type !== 'OVERRIDE').
    sort((x, y) => y.revision - x.revision)[0];
    if (!prev) return;
    store.judgments.push({
      ...prev,
      id: nextId('0199f1c3'),
      revision: latestOf(t.id).revision + 1,
      origin: { type: 'RUN', id: run.id },
      userContextVersion: run.contextVersion,
      computedAt: now()
    });
  });
};

/** 그룹의 질문 하나와 그 거래 */
interface QuestionPair {
  questionId: string;
  transaction: Transaction;
}

/** 지금 남아 있는 그룹과 질문. 배치가 지워지면 그 거래에 걸린 질문도 함께 사라진다 (api.md 3.3) */
interface LiveGroup {
  seed: QuestionGroupSeed;
  pairs: QuestionPair[];
}

const liveGroups = (): LiveGroup[] =>
QUESTION_GROUPS.map((seed) => ({
  seed,
  pairs: seed.questionIds.flatMap((questionId, index) => {
    const transaction = transactionOf((QUESTION_TRANSACTIONS[seed.groupKey] ?? [])[index] ?? '');
    return transaction ? [{ questionId, transaction }] : [];
  })
})).filter((g) => g.pairs.length > 0);

/**
 * 조회·집계에 보이는 그룹. 판정 대상(§5)이 아닌 거래의 질문은 지우지 않고 여기서만 거른다.
 * 현재 결과와 같은 조건이고, transactionId 를 줘도 거른다. 다시 포함하면 그대로 돌아온다 (#134)
 */
const visibleGroups = (): LiveGroup[] =>
liveGroups().
map((g) => ({ ...g, pairs: g.pairs.filter((p) => isJudgeable(p.transaction)) })).
filter((g) => g.pairs.length > 0);

const isAnswered = (g: LiveGroup) => store.answers.has(g.seed.groupKey);

/**
 * 소명 대기 (3.11). Override 를 뺀 최신 자동 판정이 불가인데 PENDING 질문이 남은 거래.
 * 현재 결과가 아니라 자동 판정을 본다 — Override 를 해제하면 자동 판정이 다시 현재 결과가 된다
 */
const isPresumed = (transactionId: string) =>
automaticOf(transactionId)?.verdict.code === 'UNAVAILABLE' &&
liveGroups().some(
  (g) => !isAnswered(g) && g.pairs.some((p) => p.transaction.id === transactionId)
);

/** 3.9 그룹 응답. count·totalAmount 는 시드 숫자를 쓰지 않고 거래에서 센다 */
const groupOut = (g: LiveGroup): QuestionGroup => {
  const answer = store.answers.get(g.seed.groupKey);
  // 승인일 오름차순, 같으면 transactionId 오름차순. questionIds 도 이 순서를 따른다
  const transactions = g.pairs.
  map(({ questionId, transaction: t }) => ({
    questionId,
    transactionId: t.id,
    ...summaryOf(t),
    overridden: hasActiveOverride(t.id)
  })).
  sort((a, b) => a.approvedAt.localeCompare(b.approvedAt) || a.transactionId.localeCompare(b.transactionId));
  return {
    groupKey: g.seed.groupKey,
    factType: g.seed.factType,
    status: answer ? { code: 'ANSWERED', label: '응답' } : { code: 'PENDING', label: '대기' },
    questionIds: transactions.map((t) => t.questionId),
    count: transactions.length,
    totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
    questionText: g.seed.questionText,
    options: [...g.seed.options],
    answer: answer ? { value: answer.value } : null,
    bulkAnswerable: !answer && !transactions.some((t) => isPresumed(t.transactionId)),
    transactions
  };
};

/** 그 배치의 거래에 걸린 그룹. batchId 를 주지 않으면 전부 */
const inBatch = (groups: LiveGroup[], batchId?: string) =>
groups.filter((g) => !batchId || g.pairs.some((p) => p.transaction.batchId === batchId));

const pendingGroups = (status?: string, batchId?: string) => {
  const groups = inBatch(visibleGroups(), batchId);
  if (status === 'PENDING') return groups.filter((g) => !isAnswered(g));
  if (status === 'ANSWERED') return groups.filter(isAnswered);
  // 목업은 질문을 취소하지 않는다
  if (status === 'CANCELED') return [];
  return groups;
};

/** grouped=true 정렬. 거래 건수 DESC → 금액 DESC → id ASC (#54, #134) */
const byImpact = (a: QuestionGroup, b: QuestionGroup) =>
b.count - a.count || b.totalAmount - a.totalAmount || a.questionIds[0].localeCompare(b.questionIds[0]);

const filterReviews = (status?: string, batchId?: string) =>
store.reviews.filter((r) => (!status || r.status.code === status) && (!batchId || r.batchId === batchId));

const pendingReviewCount = (batchId: string) => filterReviews('PENDING', batchId).length;

/** 배치의 분류 확인 대기 수는 저장하지 않고 지금 리뷰에서 센다 */
const batchOut = (b: UploadBatch): UploadBatch => ({
  ...b,
  classificationPendingCount: pendingReviewCount(b.id)
});

/** 3.5 분류 확인의 미해소 집계. batchId 는 적용하고 page·size 와 무관하다 */
const withReviewUnresolved = <T,>(page: Page<T>, batchId?: string): UnresolvedPage<T> => {
  const pending = filterReviews('PENDING', batchId);
  return {
    ...page,
    unresolved: {
      count: pending.length,
      amount: pending.reduce((sum, r) => sum + (transactionOf(r.transactionId)?.amount ?? 0), 0)
    }
  };
};

/**
 * 미해소 집계 (3.9). batchId·transactionId 는 적용하고 status·grouped·page 는 적용하지 않는다.
 * amount 는 거래 단위 합이라 한 거래가 여러 질문에 걸려도 한 번만 더한다.
 */
const unresolvedIn = (batchId?: string, transactionId?: string) => {
  const transactions = pendingGroups('PENDING', batchId).
  flatMap((g) => g.pairs.map((p) => p.transaction)).
  filter((t) => !transactionId || t.id === transactionId);
  return {
    count: transactions.length,
    amount: [...new Set(transactions)].reduce((sum, t) => sum + t.amount, 0)
  };
};

const withUnresolved = <T,>(
page: Page<T>,
batchId?: string,
transactionId?: string)
: QuestionPage<T> => {
  return {
    ...page,
    unresolved: unresolvedIn(batchId, transactionId)
  };
};

const notFound = (code: string, message: string) =>
Promise.reject(new ApiRequestError(404, code, message));

/** 승인·기각. 검토한 사람과 시각을 남긴다. 이미 처리한 후보는 다시 바꾸지 않는다 */
const reviewCandidate = (id: number, status: RuleCandidate['status']) => {
  if (!isAdminEmail(store.email))
  return Promise.reject(new ApiRequestError(403, 'FORBIDDEN', '관리자만 할 수 있습니다.'));
  const candidate = store.ruleCandidates.find((c) => c.id === id);
  if (!candidate) return notFound('RULE_CANDIDATE_NOT_FOUND', '규칙 후보를 찾을 수 없습니다.');
  if (candidate.status.code === 'APPROVED' || candidate.status.code === 'REJECTED')
  return Promise.reject(new ApiRequestError(409, 'CONFLICT', '이미 처리한 후보입니다.'));
  candidate.status = status;
  candidate.reviewedBy = store.email;
  candidate.reviewedAt = now();
  return delay({ ...candidate });
};

/** 지금 PENDING 그룹에 맞는 지난번 답. 다른 배치·답한 그룹의 것은 주지 않는다 */
const suggestionsIn = (batchId: string) => {
  const pending = pendingGroups('PENDING', batchId).map(groupOut);
  return QUESTION_SUGGESTIONS.filter((s) =>
  pending.some((g) => g.groupKey === s.groupKey && g.factType === s.factType)
  );
};

/** 지난번 답으로 채울 수 있는 질문 수. A 등급이고 충돌이 없고 지금 선택지에 있는 값만 센다 (3.1) */
const fillableIn = (batchId: string) => {
  const pending = pendingGroups('PENDING', batchId).map(groupOut);
  return suggestionsIn(batchId).reduce((sum, s) => {
    const group = pending.find((g) => g.groupKey === s.groupKey && g.factType === s.factType);
    const usable = s.tier === 'A' && !s.conflict && group?.bulkAnswerable && group.options.includes(s.value ?? '');
    return sum + (usable && group ? group.count : 0);
  }, 0);
};

/** 말에 그 가맹점이 나오는지. 비서 도구처럼 정규화 이름과 표기(첫 낱말 포함)를 대소문자 없이 본다 */
const mentions = (message: string, t: { merchantNorm: string; merchantRaw: string }) => {
  const text = message.toLowerCase();
  return [t.merchantNorm, t.merchantRaw, t.merchantRaw.split(' ')[0]].
  some((name) => name.length >= 2 && text.includes(name.toLowerCase()));
};

/** 카드에 쓰는 대상 요약. 비서 도구(ai/assistant/tools.py what)와 같은 모양 */
const cardTarget = (t: TransactionSummary) =>
`${t.merchantRaw.slice(0, 20)} ${Number(t.approvedAt.slice(5, 7))}/${Number(t.approvedAt.slice(8, 10))} ${t.amount.toLocaleString('ko-KR')}원`;

/**
 * 목업 비서. LLM 없이 화면과 낱말로 정해진 답과 제안 카드를 만든다. 실제 비서와 같은 응답 모양을 낸다.
 * 질문 화면: 「스타벅스는 업무미팅」(가맹점 + 선택지) → 답 카드, 「전부 개인」 → 일괄 답 카드
 * 분류 확인: 가맹점 + 카테고리 → 분류 카드. 결과: 「가능으로·불가로·확인 필요로」 → 판정 수정 카드(고른 거래)
 * 세무사·비율·세액 → 세무대리인 질문 카드. 그 밖에는 다음 할 일과 화면 이동 카드
 */
const mockChat = async ({ message, context }: AssistantChatRequest): Promise<AssistantChatResponse> => {
  const reply = (answer: string, proposals: AssistantProposal[] = []) => ({
    answer,
    proposals,
    traceId: nextId('mock-trace')
  });
  const batchId = context.batchId ?? undefined;

  if (/세무사|세무대리인|비율|세액/.test(message)) {
    const text = message.trim().slice(0, 300);
    return reply('비율이나 세액은 이 서비스가 정하지 않습니다. 세무대리인에게 물을 질문으로 넣어 둘 수 있습니다.', [
    {
      kind: 'handoff_note',
      text,
      transactionIds: context.transactionId ? [context.transactionId] : [],
      card: `세무대리인 질문 추가: ${text}`
    }]
    );
  }

  if (context.screen.startsWith('/questions') && batchId) {
    const groups = pendingGroups('PENDING', batchId).map(groupOut);
    if (/전부|모두/.test(message)) {
      const target = groups.find((g) => g.options.some((o) => message.includes(o)));
      const value = target?.options.find((o) => message.includes(o));
      const sameType = groups.filter((g) => g.factType === target?.factType);
      if (!target || !value || groups.length > 5 || sameType.length < 2 || sameType.some((g) => !g.bulkAnswerable))
      return reply('남은 질문이 많거나 소명 대기가 섞여 있어 한 번에 답할 수 없습니다. 하나씩 답해 주세요.');
      const count = sameType.reduce((sum, g) => sum + g.count, 0);
      const amount = sameType.reduce((sum, g) => sum + g.totalAmount, 0);
      return reply(`남은 「${target.factType}」 질문 ${count}건에 같은 답을 넣는 카드를 만들었습니다.`, [
      {
        kind: 'bulk_answer',
        batchId,
        factType: target.factType,
        value,
        card: `남은 '${target.factType}' 질문 ${count}건 ${amount.toLocaleString('ko-KR')}원 → '${value}'`
      }]
      );
    }
    const group = groups.find((g) =>
    g.transactions.some((t) => mentions(message, t)) && g.options.some((o) => message.includes(o))
    );
    const value = group?.options.find((o) => message.includes(o));
    if (group && value)
    return reply('말씀하신 거래의 질문에 답하는 카드를 만들었습니다. [적용]을 누르면 저장하고 다시 판정합니다.', [
    {
      kind: 'answer',
      questionIds: group.questionIds,
      value,
      source: 'ASSISTANT',
      card: `${cardTarget(group.transactions[0])} → '${value}'`
    }]
    );
  }

  if (context.screen.startsWith('/preview') && batchId) {
    const { items } = await mockApi.classificationReviews.grouped({ batchId, status: 'PENDING', size: 100 });
    const group = items.find((g) => g.transactions.some((t) => mentions(message, t)));
    const category = MERCHANT_CATEGORIES.find((c) => message.includes(c));
    if (group && category)
    return reply('말씀하신 가맹점의 카테고리를 정하는 카드를 만들었습니다.', [
    {
      kind: 'classification',
      reviewIds: group.reviewIds,
      merchantCategory: category,
      card: `${cardTarget(group.transactions[0])} → ${category}`
    }]
    );
  }

  const toVerdict = /확인 필요로/.test(message) ?
  'NEEDS_REVIEW' :
  /가능으로/.test(message) ?
  'AVAILABLE' :
  /불가로/.test(message) ?
  'UNAVAILABLE' :
  null;
  if (context.screen.startsWith('/results') && context.transactionId && toVerdict) {
    const current = currentOf(context.transactionId);
    const t = transactionOf(context.transactionId);
    if (current && t)
    return reply('판정을 바꾸는 카드를 만들었습니다. 바꾸는 것은 직접 [적용]을 눌러 정합니다.', [
    {
      kind: 'override',
      judgmentId: current.id,
      toVerdict,
      reason: message.trim(),
      card: `${cardTarget(summaryOf(t))} 판정 ${current.verdict.label} → ${LABEL[toVerdict]}`
    }]
    );
  }

  const next = batchId ? (await mockApi.progress.get(batchId)).next : null;
  return next ?
  reply(`다음 할 일은 「${next.label}」입니다.`, [
  { kind: 'navigation', route: next.route, card: `다음 할 일: ${next.label}` }]
  ) :
  reply('카드내역을 올리면 분류 확인부터 차례로 안내합니다.', [
  { kind: 'navigation', route: '/upload', card: '카드내역 화면으로 이동' }]
  );
};

// ── 구현 ────────────────────────────────────────────

export const mockApi: Api = {
  auth: {
    login: ({ email, password }) => {
      if (password !== MOCK_PASSWORD)
      return Promise.reject(
        new ApiRequestError(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.')
      );
      store.email = email;
      return delay(undefined);
    },
    // 목업은 새로고침하면 상태가 사라지므로 이어 갈 로그인이 없다
    restore: () => delay(false),
    logout: () => {
      store.email = null;
      return delay(undefined);
    },
    // 목업은 토큰이 만료되지 않는다
    onLost: () => () => undefined
  },

  users: {
    me: () =>
    store.email === null ?
    Promise.reject(new ApiRequestError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')) :
    delay({
      id: USER_ID,
      email: store.email,
      createdAt: '2026-09-01T10:00:00+09:00',
      role: isAdminEmail(store.email) ? 'ADMIN' as const : 'USER' as const
    }),
    remove: () => delay(undefined)
  },

  contexts: {
    create: (body) => {
      // Context 는 고치지 않고 새 버전을 만든다 (3.2)
      const ref = {
        id: nextId('0199d3a1'),
        version: Math.max(0, ...store.contexts.map((c) => c.version)) + 1
      };
      store.contexts.push({ ...body, ...ref, userId: USER_ID, createdAt: now() });
      return delay(ref);
    },
    current: () => delay(store.contexts.at(-1) ?? null),
    list: () => delay([...store.contexts])
  },

  uploads: {
    // 목업은 Idempotency-Key 재사용·중복 파일을 흉내 내지 않는다. 오류 화면은 failNextUpload 로 본다
    create: (body) => {
      const failure = store.failUpload;
      if (failure) {
        store.failUpload = null;
        return new Promise((_, reject) => window.setTimeout(() => reject(failure), LATENCY_MS));
      }
      const batch: UploadBatch = {
        id: nextId('0199c8f2'),
        sourceType: body.sourceType,
        cardIssuer: body.cardIssuer,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        transactionCount: body.transactions.length,
        skippedDuplicateCount: 0,
        classificationPendingCount: 0,
        createdAt: now()
      };
      store.batches.unshift(batch);

      // 파서가 준 거래를 실제로 저장한다. 저장하지 않으면 업로드 이력은 N건인데
      // 거래 목록은 비고, 판정도 0건으로 돌아 화면끼리 숫자가 어긋난다
      const rows = body.transactions.map((parsed) => {
        const guess = guessMerchant(parsed.merchantRaw);
        const transaction: Transaction = {
          id: nextId('0199c8f2'),
          batchId: batch.id,
          approvedAt: parsed.approvedAt,
          merchantRaw: parsed.merchantRaw,
          merchantNorm: guess.merchantNorm,
          merchantCategory: guess.category ?? UNCLASSIFIED,
          classificationStatus: guess.category ?
          { code: 'CLASSIFIED', label: '분류 완료' } :
          { code: 'NEEDS_REVIEW', label: '확인 필요' },
          amount: parsed.amount,
          installmentMonths: parsed.installmentMonths ?? 0,
          sourceStatus: { code: parsed.status, label: STATUS_LABEL[parsed.status] },
          userInclusion: 'AUTO',
          effectiveStatus: { code: parsed.status, label: STATUS_LABEL[parsed.status] }
        };
        const effective = effectiveOf(transaction);
        transaction.effectiveStatus = { code: effective, label: STATUS_LABEL[effective] };
        return { transaction, unclassified: guess.category === null };
      });
      store.transactions.push(...rows.map((r) => r.transaction));

      // 분류하지 못한 거래는 업로드를 막지 않고 분류 확인으로 남긴다.
      // 취소상계·대상제외는 판정 대상이 아니라 분류 확인을 만들지 않는다 (#124)
      const reviews: ClassificationReview[] = rows.
      filter((r) => r.unclassified && r.transaction.effectiveStatus.code === 'JUDGEABLE').
      map((r) => ({
        id: nextId('0199d7e4'),
        batchId: batch.id,
        transactionId: r.transaction.id,
        merchantRaw: r.transaction.merchantRaw,
        merchantNorm: r.transaction.merchantNorm,
        status: { code: 'PENDING', label: '대기' },
        suggestedCategories: [...SUGGESTED_CATEGORIES],
        createdAt: batch.createdAt,
        resolvedAt: null
      }));
      store.reviews.push(...reviews);
      batch.classificationPendingCount = reviews.length;
      // 201 응답은 다섯 필드뿐이다 (api.md 3.3)
      return delay({
        id: batch.id,
        transactionCount: batch.transactionCount,
        skippedDuplicateCount: batch.skippedDuplicateCount,
        classificationPendingCount: pendingReviewCount(batch.id),
        createdAt: batch.createdAt
      });
    },
    list: (q) => delay(paginate(store.batches.map(batchOut), q?.page, q?.size)),
    get: (id) => {
      const b = store.batches.find((x) => x.id === id);
      return b ? delay(batchOut(b)) : notFound('BATCH_NOT_FOUND', '업로드를 찾을 수 없습니다.');
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
      // 지운 배치의 거래에 걸린 답과 수정만 지운다. 다른 배치의 답·수정은 남는다
      [...store.answers.keys()].forEach((groupKey) => {
        if ((QUESTION_TRANSACTIONS[groupKey] ?? []).some((id) => txIds.has(id))) {
          store.answers.delete(groupKey);
          store.factVersions.delete(groupKey);
        }
      });
      [...store.overrides].forEach(([overrideId, o]) => {
        if (txIds.has(o.transactionId)) store.overrides.delete(overrideId);
      });
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
      items = items.filter((t) => currentOf(t.id)?.verdict.code === q.verdict);
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
      const context = store.contexts.find((c) => c.id === contextId);
      if (!context) return notFound('CONTEXT_NOT_FOUND', '사업자 문진을 찾을 수 없습니다.');
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
        contextVersion: context.version,
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
      const failCode = store.failNextCode;
      store.failNext = 0;
      store.failNextCode = 'RULE_PROCESSING_FAILED';
      if (failCount > 0) {
        const targets = store.transactions.filter(judgeable).slice(0, failCount);
        store.failures.set(
          run.id,
          targets.map((t) => ({
            transactionId: t.id,
            errorCode: failCode,
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
          judgeRun(run);
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
       * runId 는 그 Run 이 만든 판정 그대로, batchId·year 는 거래별 현재 판정이다 (api.md 3.7).
       */
      const rows = scope.runId ?
      producedBy(scope.runId) :
      currentAll().filter((j) => {
        const t = transactionOf(j.transactionId);
        if (!t) return false;
        // 지금 판정 대상이 아닌 거래(제외·미분류)는 집계하지 않는다 (api.md 3.7, §5)
        if (!isJudgeable(t)) return false;
        if (scope.batchId && t.batchId !== scope.batchId) return false;
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
        sort((a, b) => b.finalAmount - a.finalAmount || a.account.localeCompare(b.account))
      });
    },
    list: (q) => {
      // runId 는 그 Run 이 만든 판정, transactionId + latestOnly=false 는 그 거래의 이력 전체,
      // 그 외는 거래별 현재 판정이다 (api.md 3.7)
      const history = q?.transactionId !== undefined && q.latestOnly === false;
      let items = q?.runId ?
      producedBy(q.runId) :
      history ?
      store.judgments.filter((j) => j.transactionId === q?.transactionId) :
      currentAll();
      if (q?.transactionId) items = items.filter((j) => j.transactionId === q.transactionId);
      if (q?.verdict) items = items.filter((j) => j.verdict.code === q.verdict);
      if (q?.batchId)
      items = items.filter((j) => transactionOf(j.transactionId)?.batchId === q.batchId);
      if (q?.year)
      items = items.filter((j) =>
      transactionOf(j.transactionId)?.approvedAt.startsWith(String(q.year))
      );
      // 거래·Run 을 지정하지 않은 현재 판정 조회에서는 지금 판정 대상이 아닌 거래(제외·미분류)를 빼낸다.
      // transactionId 를 주면 제외한 거래라도 그 거래의 판정을 준다 (api.md 3.7, §5)
      if (!q?.transactionId && !q?.runId)
      items = items.filter((j) => {
        const t = transactionOf(j.transactionId);
        return t !== undefined && isJudgeable(t);
      });
      const out = items.
      map(withTransaction).
      filter((j): j is Judgment => j !== null).
      sort((a, b) => b.computedAt.localeCompare(a.computedAt) || b.id.localeCompare(a.id));
      return delay(paginate(out, q?.page, q?.size ?? 20));
    },
    get: (id) => {
      const j = store.judgments.find((x) => x.id === id);
      const out = j && withTransaction(j);
      return out ? delay(out) : notFound('JUDGMENT_NOT_FOUND', '판정을 찾을 수 없습니다.');
    },
    // 목업은 Idempotency-Key 재사용을 흉내 내지 않는다 (업로드와 같다)
    override: (id, body) => {
      const prev = store.judgments.find((x) => x.id === id);
      if (!prev) return notFound('JUDGMENT_NOT_FOUND', '판정을 찾을 수 없습니다.');
      // 확인 필요로 되돌리면 질문 없는 확인 필요가 된다 (#62)
      if (body.toVerdict === 'NEEDS_REVIEW')
      return Promise.reject(
        new ApiRequestError(422, 'UNPROCESSABLE_ENTITY', '확인 필요로는 바꿀 수 없습니다.')
      );
      // 현재 판정이 아니거나 판정 대상이 아닌 거래는 막는다 (#62). 활성 Override 가 있으면
      // 그 뒤에 자동 판정이 더 쌓여도 현재 판정은 Override 다 (3.7)
      const t = transactionOf(prev.transactionId);
      if (!t || t.effectiveStatus.code !== 'JUDGEABLE' || currentOf(t.id)?.id !== id)
      return Promise.reject(
        new ApiRequestError(409, 'CONFLICT', '지금 판정이 아니어서 바꿀 수 없습니다.')
      );
      const amount = t.amount;
      const overrideId = nextId('0199ab12');
      const next: JudgmentSeed = {
        ...prev,
        id: nextId('0199f1c3'),
        revision: latestOf(prev.transactionId).revision + 1,
        origin: { type: 'OVERRIDE', id: overrideId },
        verdict: { code: body.toVerdict, label: LABEL[body.toVerdict] },
        finalAmount: body.toVerdict === 'AVAILABLE' ? prev.finalAmount ?? amount : null,
        computedAt: now()
      };
      store.judgments.push(next);
      // 같은 거래의 기존 활성 Override 는 끈다. 거래마다 활성은 하나뿐이다
      store.overrides.forEach((o) => {
        if (o.transactionId === prev.transactionId) o.active = false;
      });
      store.overrides.set(overrideId, {
        transactionId: prev.transactionId,
        judgmentId: next.id,
        active: true
      });
      return delay({ ...next, transaction: summaryOf(t) });
    },
    removeOverride: (overrideId) => {
      const found = store.overrides.get(overrideId);
      if (!found)
      return notFound('JUDGMENT_OVERRIDE_NOT_FOUND', '사용자 수정을 찾을 수 없습니다.');
      // 이미 해제된 것도 204 다. 기록은 지우지 않고 끄기만 한다 (api.md 3.8)
      found.active = false;
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
      const items: Question[] = pendingGroups(q?.status, q?.batchId).flatMap((g) => {
        const answer = store.answers.get(g.seed.groupKey);
        return g.pairs.map(({ questionId, transaction }) => ({
          id: questionId,
          batchId: transaction.batchId,
          transactionId: transaction.id,
          groupKey: g.seed.groupKey,
          factType: g.seed.factType,
          questionText: g.seed.questionText,
          options: [...g.seed.options],
          status: answer ?
          { code: 'ANSWERED' as const, label: '응답' } :
          { code: 'PENDING' as const, label: '대기' },
          answeredFactId: answer ? factIdOf(g.seed.groupKey) : null,
          answer: answer ? { value: answer.value } : null,
          createdAt: '2026-09-12T14:05:00+09:00',
          answeredAt: answer?.at ?? null
        }));
      }).filter((question) => !q?.transactionId || question.transactionId === q.transactionId);
      return delay(withUnresolved(paginate(items, q?.page, q?.size ?? 20), q?.batchId, q?.transactionId));
    },
    grouped: (q) =>
    delay(
      withUnresolved(
        paginate(pendingGroups(q?.status, q?.batchId).map(groupOut).sort(byImpact), q?.page, q?.size ?? 20),
        q?.batchId,
        q?.transactionId
      )
    ),
    respond: ({ questionIds, answer }) => {
      // 검사 순서와 첫 실패만 돌려주는 것은 api.md 3.10 을 따른다
      if (questionIds.length === 0 || !answer?.value)
      return Promise.reject(new ApiRequestError(400, 'VALIDATION_ERROR', '질문과 답을 모두 보내야 합니다.'));
      // 살아 있는 그룹에서 찾는다. 배치를 지운 뒤에는 404 여야 한다 (정적 배열을 보면 TypeError 가 난다)
      const groups = liveGroups();
      const owners = questionIds.map((id) => groups.find((g) => g.pairs.some((p) => p.questionId === id)));
      const group = owners[0];
      if (!group || owners.some((g) => g === undefined))
      return notFound('QUESTION_NOT_FOUND', '질문을 찾을 수 없습니다.');
      const batches = new Set(
        questionIds.map((id) => owners.flatMap((g) => g?.pairs ?? []).find((p) => p.questionId === id)?.transaction.batchId)
      );
      if (batches.size > 1)
      return Promise.reject(
        new ApiRequestError(422, 'QUESTIONS_FROM_DIFFERENT_BATCHES', '서로 다른 업로드의 질문은 함께 답할 수 없습니다.')
      );
      // 한 요청의 질문은 같은 Batch·groupKey·factType 이어야 한다 (3.10)
      if (owners.some((g) => g !== group))
      return Promise.reject(
        new ApiRequestError(409, 'QUESTION_GROUP_MISMATCH', '서로 다른 질문을 함께 답할 수 없습니다.')
      );
      if (!group.seed.options.includes(answer.value))
      return Promise.reject(new ApiRequestError(422, 'INVALID_ANSWER_VALUE', '선택지에 없는 값입니다.'));
      // 이미 답한 그룹이면 정정이다. 기존 UserFact 를 고치지 않고 새 version 을 만든다 (3.10 답변 정정)
      const { groupKey } = group.seed;
      const version = (store.factVersions.get(groupKey) ?? 0) + 1;
      store.factVersions.set(groupKey, version);
      store.answers.set(groupKey, { value: answer.value, at: now() });
      // 제외·미분류·판정 이력 없는 거래는 다시 판정하지 않는다. 다시 포함해도 새 Run 전까지 옛 판정이 남는다 (3.10)
      const rejudged = group.pairs.
      map((p) => p.transaction).
      filter((t) => isJudgeable(t) && automaticOf(t.id) !== undefined);
      rejudged.forEach((t) => rejudge(t.id, groupKey, answer.value));
      // 명세 3.10: 새 JudgmentRun 은 만들지 않는다. runId 는 응답에서 제거됐다
      return delay({
        answeredCount: group.pairs.length,
        factId: factIdOf(groupKey),
        rejudgedTransactionCount: rejudged.length
      });
    },
    suggestions: (batchId) => delay({ items: suggestionsIn(batchId) }),
    bulkAnswer: ({ batchId, factType, answer }) => {
      // 이 배치의 PENDING 중 factType 이 같은 질문만 한 번에 닫는다. 새 Run 은 만들지 않는다 (3.11)
      if (!store.batches.some((b) => b.id === batchId))
      return notFound('BATCH_NOT_FOUND', '업로드를 찾을 수 없습니다.');
      if (!inBatch(liveGroups(), batchId).some((g) => g.seed.factType === factType))
      return Promise.reject(new ApiRequestError(422, 'UNKNOWN_FACT_TYPE', '알 수 없는 질문 종류입니다.'));
      const pending = pendingGroups('PENDING', batchId);
      // 소명 대기(불가인데 질문이 남음)는 일괄 응답 대상에서 뺀다. 휴일 카드도 같은 「용도」를 써서
      // 한 번에 답하면 주말 불가 추정이 전부 풀린다 (rule-card-fields.md)
      const presumed = (g: LiveGroup) => g.pairs.some((p) => isPresumed(p.transaction.id));
      const sameType = pending.filter((g) => g.seed.factType === factType);
      const targets = sameType.filter((g) => !presumed(g));
      const excluded = sameType.filter(presumed);
      // 하나라도 허용하지 않으면 아무것도 바꾸지 않는다. 제외 대상은 이 검사에 넣지 않는다
      if (targets.some((g) => !g.seed.options.includes(answer.value)))
      return Promise.reject(
        new ApiRequestError(422, 'INVALID_ANSWER_VALUE', '모든 대상 질문이 허용하는 값이 아닙니다.')
      );
      const questionCount = (list: LiveGroup[]) => list.reduce((sum, g) => sum + g.pairs.length, 0);
      const rejudged = new Set<string>();
      targets.forEach((group) => {
        // 일괄 답변도 그룹마다 새 UserFact 다
        const { groupKey } = group.seed;
        store.factVersions.set(groupKey, (store.factVersions.get(groupKey) ?? 0) + 1);
        store.answers.set(groupKey, { value: answer.value, at: now() });
        group.pairs.forEach(({ transaction: t }) => {
          if (rejudged.has(t.id) || !isJudgeable(t) || !automaticOf(t.id)) return;
          rejudge(t.id, groupKey, answer.value);
          rejudged.add(t.id);
        });
      });
      return delay({
        answeredCount: questionCount(targets),
        // 요청 당시 PENDING 중 factType 이 달라 건너뛴 수와, 같지만 소명 대기라 건너뛴 수 (3.11)
        skippedCount: questionCount(pending.filter((g) => g.seed.factType !== factType)),
        excludedCount: questionCount(excluded),
        factIds: targets.map((g) => factIdOf(g.seed.groupKey)),
        rejudgedTransactionCount: rejudged.size,
        unresolved: unresolvedIn(batchId)
      });
    }
  },

  classificationReviews: {
    list: (q) =>
    delay(
      withReviewUnresolved(paginate(filterReviews(q?.status, q?.batchId), q?.page, q?.size ?? 20), q?.batchId)
    ),
    grouped: (q) => {
      // 서버는 카드사 트랙(사업자번호/문자열)까지 섞어 묶으므로 같은 merchantNorm 이
      // 다른 그룹으로 갈릴 수 있다. 목업도 그 상황을 만들어 둔다 (#63 리뷰).
      const byMerchant = new Map<string, ClassificationReview[]>();
      filterReviews(q?.status, q?.batchId).forEach((r) => {
        const track = r.merchantRaw.startsWith('PADDLE.NET* CURSOR') ? ':bizno' : '';
        const key = `merchant:${r.merchantNorm}${track}`;
        byMerchant.set(key, [...(byMerchant.get(key) ?? []), r]);
      });
      const items: ClassificationReviewGroup[] = [...byMerchant].map(([groupKey, rows]) => {
        // 승인일 오름차순, 같으면 transactionId 오름차순 (api.md 3.5)
        const transactions = rows.
        map((r) => ({ review: r, t: transactionOf(r.transactionId) })).
        filter((x): x is { review: ClassificationReview; t: Transaction } => Boolean(x.t)).
        map(({ review, t }) => ({
          reviewId: review.id,
          transactionId: t.id,
          ...summaryOf(t)
        })).
        sort((a, b) => a.approvedAt.localeCompare(b.approvedAt) || a.transactionId.localeCompare(b.transactionId));
        return {
          groupKey,
          merchantNorm: rows[0].merchantNorm,
          reviewIds: rows.map((r) => r.id),
          count: rows.length,
          totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
          merchantRaw: transactions[0]?.merchantRaw ?? rows[0].merchantRaw,
          suggestedCategories: rows[0].suggestedCategories,
          transactions
        };
      });
      return delay(withReviewUnresolved(paginate(items, q?.page, q?.size ?? 20), q?.batchId));
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
      // 완료된 Run 이 있으면 해결된 거래를 판정한다 (api.md 3.5, origin = CLASSIFICATION_REVIEW).
      // 세기만 하고 판정을 만들지 않으면 Run 은 「N건 완료」인데 결과·요약 합계가 모자란다
      const completedRun = [...store.runs.values()].find((r) => r.status.code === 'COMPLETED');
      const judged = completedRun ?
      rows.flatMap((r) => {
        const t = transactionOf(r.transactionId);
        if (!t || t.effectiveStatus.code !== 'JUDGEABLE') return [];
        const verdict = VERDICT_BY_CATEGORY[merchantCategory] ?? 'NEEDS_REVIEW';
        store.judgments.push({
          id: nextId('0199f1c3'),
          transactionId: t.id,
          revision: (latestOf(t.id)?.revision ?? 0) + 1,
          origin: { type: 'CLASSIFICATION_REVIEW', id: r.id },
          verdict: { code: verdict, label: LABEL[verdict] },
          outOfScope: false,
          blockedAtGate: null,
          account: verdict === 'AVAILABLE' ? '지급수수료' : null,
          finalAmount: verdict === 'AVAILABLE' ? t.amount : null,
          isInference: false,
          unmatchedReason: null,
          attributes: { merchantCategory },
          ruleCardId: null,
          ruleCardVersion: null,
          appliedRuleIds: [],
          rulesCommitSha: RULES_SHA,
          userContextVersion: completedRun.contextVersion,
          explanation: `가맹점 업종을 「${merchantCategory}」로 확인한 뒤 다시 판정했습니다.`,
          computedAt: now(),
          citations: []
        });
        return [t.id];
      }) :
      [];
      return delay({
        resolvedCount: rows.length,
        merchantCategory,
        judgedCount: judged.length
      });
    }
  },

  admin: {
    ruleCandidates: {
      list: (q) => {
        if (!isAdminEmail(store.email))
        return Promise.reject(new ApiRequestError(403, 'FORBIDDEN', '관리자만 볼 수 있습니다.'));
        const items = store.ruleCandidates.
        filter((c) => !q?.status || c.status.code === q.status).
        sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
        return delay(paginate(items, q?.page, q?.size ?? 20));
      },
      approve: (id) => reviewCandidate(id, { code: 'APPROVED', label: '승인' }),
      reject: (id) => reviewCandidate(id, { code: 'REJECTED', label: '기각' })
    }
  },

  assistant: {
    chat: (body) => {
      const failure = store.failAssistant;
      if (failure) {
        store.failAssistant = null;
        return new Promise((_, reject) => window.setTimeout(() => reject(failure), LATENCY_MS));
      }
      // 실제 비서는 한 턴에 몇 초 걸린다. 기다리는 동안의 화면을 볼 수 있게 조금 늦춘다
      return mockChat(body).then((result) => new Promise((resolve) => window.setTimeout(() => resolve(result), 600)));
    }
  },

  progress: {
    get: (batchId) => {
      const batch = store.batches.find((b) => b.id === batchId);
      if (!batch) return notFound('BATCH_NOT_FOUND', '업로드를 찾을 수 없습니다.');
      const context = store.contexts.at(-1);
      const reviews = filterReviews('PENDING', batchId);
      const run = [...store.runs.values()].filter((r) => r.batchId === batchId).at(-1);
      const questions = unresolvedIn(batchId);
      const next =
      reviews.length > 0 ?
      { step: 'CLASSIFICATION', route: '/preview', label: '분류 확인하기' } :
      !context ?
      { step: 'INTERVIEW', route: '/interview', label: '사업자 문진 하기' } :
      !run ?
      { step: 'RUN', route: '/confirm', label: '판정 전 확인하기' } :
      questions.count > 0 ?
      { step: 'QUESTIONS', route: '/questions', label: '질문에 답하기' } :
      { step: 'SUMMARY', route: '/summary', label: '요약 보기' };
      return delay({
        batch: {
          label: `${batch.cardIssuer} · ${batch.periodStart.slice(0, 7)}`,
          transactionCount: store.transactions.filter((t) => t.batchId === batchId).length
        },
        context: context ?
        { version: context.version, bookkeeping: context.bookkeepingDuty, hasEmployee: context.hasEmployee } :
        null,
        classification: {
          pendingCount: reviews.length,
          pendingAmount: reviews.reduce((sum, r) => sum + (transactionOf(r.transactionId)?.amount ?? 0), 0)
        },
        run: run ? { status: run.status.code } : null,
        questions: { pendingCount: questions.count, pendingAmount: questions.amount, fillableFromPrevious: fillableIn(batchId) },
        next
      });
    }
  },

  handoffNotes: {
    list: () => delay([...store.handoffNotes]),
    create: ({ text, transactionIds }) => {
      const trimmed = text.trim();
      if (!trimmed || trimmed.length > 300)
      return Promise.reject(new ApiRequestError(400, 'VALIDATION_ERROR', '질문은 1~300자로 적어 주세요.'));
      const note = { id: nextId('0199bb21'), text: trimmed, transactionIds: [...transactionIds], createdAt: now() };
      store.handoffNotes.push(note);
      return delay(note);
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
 * 그다음 판정을 실행하면 그 Run 이 부분 실패로 끝난다. 실패 코드도 고를 수 있다(api.md 3.6):
 *   mockControls.failNextRun(2, 'RUN_START_FAILED')
 */
export const mockControls = {
  failNextRun(count: number, code = 'RULE_PROCESSING_FAILED') {
    store.failNext = Math.max(0, count);
    store.failNextCode = code;
  },
  /**
   * 다음 업로드 한 번을 이 오류로 실패시킨다. 콘솔에서:
   *   (await import('/src/api/mock/index.ts')).mockControls.failNextUpload({ status: 0, code: 'NETWORK_ERROR' })
   */
  failNextUpload(error: {status: number;code: string;message?: string;traceId?: string;}) {
    store.failUpload = new ApiRequestError(
      error.status,
      error.code,
      error.message ?? `요청을 처리하지 못했습니다. (${error.status})`,
      error.traceId
    );
  },
  /** 다음 비서 요청 한 번을 실패시킨다. 429 는 Retry-After 5초 (AI 서버의 ASSISTANT_BUSY) */
  failNextAssistant(status: 422 | 429) {
    store.failAssistant =
    status === 429 ?
    new ApiRequestError(429, 'ASSISTANT_BUSY', '이전 질문에 답하는 중입니다.', '', 5) :
    new ApiRequestError(422, 'VALIDATION_ERROR', '요청을 확인해 주세요.');
  }
};

export const mockSeedSession = {
  batchId: UPLOAD_BATCH.id,
  contextRef: { id: '0199d3a1-0000-7000-8000-000000000001', version: 4 },
  runId: JUDGMENT_RUN.id
};
