/**
 * docs/api.md (v2) 와 1:1로 맞춘 타입.
 * 필드 이름·값은 계약을 따르고, 화면 편의 필드를 여기에 추가하지 않는다.
 */

/** 상태값은 항상 code + label 로 내려온다. 분기는 code, 표시는 label. */
export interface Coded<C extends string> {
  code: C;
  label: string;
}

// ── 2. Enum ─────────────────────────────────────────

/** 2.1 판정 결과. 「일부 인정」은 AVAILABLE + finalAmount < amount 로 표현한다 */
export type Verdict = 'AVAILABLE' | 'UNAVAILABLE' | 'NEEDS_REVIEW';

/** 2.2 파서가 카드 명세서에서 판정한 원본 상태. 사용자가 바꿀 수 없다 */
export type SourceStatus = 'JUDGEABLE' | 'CANCELED_OFFSET' | 'EXCLUDED';

/** 2.3 사용자 포함 상태. 기본 AUTO. CANCELED_OFFSET 은 INCLUDED 로 못 바꾼다 */
export type UserInclusion = 'AUTO' | 'INCLUDED' | 'EXCLUDED';

/** 2.3 sourceStatus + userInclusion 을 합친 최종 판정 대상 여부 */
export type EffectiveStatus = SourceStatus;

/** 2.4 가맹점 분류 상태. merchantCategory = 미분류 이면 NEEDS_REVIEW */
export type ClassificationStatus = 'CLASSIFIED' | 'NEEDS_REVIEW';

/** 2.5 Question 상태. CANCELED 는 시스템이 변경한다 */
export type QuestionStatus = 'PENDING' | 'ANSWERED' | 'CANCELED';

/** 2.6 ClassificationReview 상태 */
export type ReviewStatus = 'PENDING' | 'RESOLVED';

/** 2.7 JudgmentRun 상태. 결과에 NEEDS_REVIEW 가 있어도 COMPLETED 다 */
export type RunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILED' | 'FAILED';

/** 2.8 Judgment revision 이 생성된 직접 원인 */
export type JudgmentOriginType = 'RUN' | 'USER_FACT' | 'CLASSIFICATION_REVIEW' | 'OVERRIDE';

export type BookkeepingDuty = '복식부기' | '간편장부' | '추계';
export type CardIssuer = '국민' | '기업';
export type SourceType = '승인내역' | '청구내역' | '판별불가';
export type GateId = 'G0' | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6';

// ── 1. 공통 ─────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  traceId: string;
}

export interface PageInfo {
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

export interface Page<T> {
  items: T[];
  page: PageInfo;
}

// ── 3.1 사용자 ──────────────────────────────────────

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

// ── 3.2 사업자 Context ──────────────────────────────

export interface BusinessContext {
  /** 업종코드. IT 한정이라 62010 고정 */
  industryCode: string;
  prevYearRevenue: number;
  businessOpenDate: string;
  bookkeepingDuty: BookkeepingDuty;
  hasEmployee: boolean;
  /** 자택 작업공간 면적 비율(%). 0이면 해당 없음 */
  homeOfficeRatio: number;
}

export interface BusinessContextRef {
  id: string;
  version: number;
}

// ── 3.3 업로드 ──────────────────────────────────────

/** 프론트 파서가 생성해 보내는 거래 행. 서버가 재계산하지 않는다 */
export interface ParsedTransaction {
  approvedAt: string;
  merchantRaw: string;
  amount: number;
  naturalKey: string;
  /** 파서의 sourceStatus */
  status: SourceStatus;
  installmentMonths?: number;
  approvalNo?: string;
  bizNo?: string;
  branch?: string;
  branchRaw?: string;
  memo?: string;
  isAggregated?: boolean;
  needsReview?: boolean;
  reviewReason?: string;
  sourceCard?: string;
}

export interface UploadBatchRequest {
  sourceType: SourceType;
  cardIssuer: CardIssuer;
  periodStart: string;
  periodEnd: string;
  /** 프론트에서 원본 파일로 계산 */
  fileHash: string;
  transactions: ParsedTransaction[];
}

export interface UploadBatch {
  id: string;
  sourceType: SourceType;
  cardIssuer: CardIssuer;
  periodStart: string;
  periodEnd: string;
  transactionCount: number;
  skippedDuplicateCount: number;
  /** 분류 확인이 필요한 거래 수 */
  classificationPendingCount: number;
  createdAt: string;
}

// ── 3.4 거래 ────────────────────────────────────────

export interface Transaction {
  id: string;
  batchId: string;
  approvedAt: string;
  merchantRaw: string;
  merchantNorm: string;
  merchantCategory: string;
  classificationStatus: Coded<ClassificationStatus>;
  amount: number;
  installmentMonths: number;
  sourceStatus: Coded<SourceStatus>;
  userInclusion: UserInclusion;
  effectiveStatus: Coded<EffectiveStatus>;
}

// ── 3.5 가맹점 분류 확인 ────────────────────────────

export interface ClassificationReview {
  id: string;
  batchId: string;
  transactionId: string;
  merchantRaw: string;
  merchantNorm: string;
  status: Coded<ReviewStatus>;
  suggestedCategories: string[];
  createdAt: string;
  resolvedAt: string | null;
}

export interface ClassificationReviewGroup {
  groupKey: string;
  reviewIds: string[];
  /** 항상 reviewIds.length 와 같다 */
  count: number;
  totalAmount: number;
  merchantRaw: string;
  suggestedCategories: string[];
}

export interface ClassificationResponseRequest {
  reviewIds: string[];
  /** 「미분류」는 제출할 수 없다 */
  merchantCategory: string;
}

export interface ClassificationResponseResult {
  resolvedCount: number;
  merchantCategory: string;
  /** Run 이력이 없으면 0. 있으면 해결된 거래만 재판정한 수 */
  judgedCount: number;
}

// ── 3.6 판정 실행 ───────────────────────────────────

/** POST /judgment-runs 응답 (202) */
export interface JudgmentRunCreated {
  id: string;
  status: Coded<RunStatus>;
  totalCount: number;
}

/** GET /judgment-runs/{runId} 응답 */
export interface JudgmentRun extends JudgmentRunCreated {
  processedCount: number;
  failedCount: number;
  startedAt: string | null;
  completedAt: string | null;
}

/** 기술적으로 처리하지 못한 거래. NEEDS_REVIEW 는 실패가 아니다 */
export interface JudgmentRunFailure {
  transactionId: string;
  errorCode: string;
  message: string;
  failedAt: string;
}

// ── 3.7 판정 결과 ───────────────────────────────────

export interface Citation {
  statuteVersionId: number;
  statuteId: string;
}

export interface JudgmentOrigin {
  type: JudgmentOriginType;
  id: string | null;
}

export interface Judgment {
  id: string;
  transactionId: string;
  /** Transaction 재판정마다 증가 */
  revision: number;
  /** 이 revision 이 생성된 직접 원인 */
  origin: JudgmentOrigin;
  verdict: Coded<Verdict>;
  /** 룰엔진 판정 범위 밖(핸드오프). NEEDS_REVIEW 일 때만 true 일 수 있다 */
  outOfScope: boolean;
  blockedAtGate: GateId | null;
  account: string | null;
  /** 안분·상각·한도 적용 후 인정 금액 */
  finalAmount: number | null;
  /** 룰로 확정하지 못해 fallback 인지 */
  isInference: boolean;
  unmatchedReason: string | null;
  attributes: Record<string, unknown>;
  /** 대표 적용 RuleCard */
  ruleCardId: string | null;
  ruleCardVersion: number | null;
  /** 적용된 전체 RuleCard ID */
  appliedRuleIds: string[];
  /** 사용된 Rules revision */
  rulesCommitSha: string | null;
  /** 판정에 사용된 Context 버전 */
  userContextVersion: number | null;
  /** RuleCard 의 reason. AI 생성 아님. 없으면 null */
  explanation: string | null;
  computedAt: string;
  citations: Citation[];
}

export interface VerdictSummary {
  count: number;
  finalAmount: number;
}

export type SummaryScopeType = 'BATCH' | 'YEAR' | 'RUN';

export interface JudgmentSummary {
  scope: { type: SummaryScopeType; id: string };
  totalCount: number;
  byVerdict: Record<Verdict, VerdictSummary>;
  byAccount: { account: string; count: number; finalAmount: number }[];
}

export interface Statute {
  statuteVersionId: number;
  statuteId: string;
  title: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceUrl: string;
  body: string;
}

export interface OverrideRequest {
  toVerdict: Verdict;
  reason: string;
}

// ── 3.9~3.11 확인 질문 ──────────────────────────────

export interface Question {
  id: string;
  transactionId: string;
  factType: string;
  status: Coded<QuestionStatus>;
  questionText: string;
  options: string[];
  createdAt: string;
}

export interface QuestionGroup {
  groupKey: string;
  /** 같은 groupKey 라도 factType 이 다르면 별도 그룹 */
  factType: string;
  questionIds: string[];
  /** 항상 questionIds.length 와 같다 */
  count: number;
  totalAmount: number;
  questionText: string;
  options: string[];
}

/** 페이지네이션과 무관한 미해소 집계. "확인 필요 24건 · 340,000원" 용 */
export interface UnresolvedSummary {
  count: number;
  amount: number;
}

export interface QuestionPage<T> extends Page<T> {
  unresolved: UnresolvedSummary;
}

export interface QuestionResponseRequest {
  questionIds: string[];
  answer: { value: string };
}

export interface QuestionResponseResult {
  answeredCount: number;
  runId: string;
}

export interface BulkAnswerRequest {
  batchId: string;
  factType: string;
  answer: { value: string };
}

export interface BulkAnswerResult {
  answeredCount: number;
  skippedCount: number;
  factIds: string[];
}
