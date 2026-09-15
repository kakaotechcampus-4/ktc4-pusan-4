/**
 * API 명세(2. Enum, 3. 엔드포인트)와 1:1로 맞춘 타입.
 * 필드 이름·값은 명세를 따르고, 화면 편의 필드를 여기에 추가하지 않는다.
 */

/** 상태값은 항상 code + label 로 내려온다. 분기는 code, 표시는 label. */
export interface Coded<C extends string> {
  code: C;
  label: string;
}

// ── Enum ────────────────────────────────────────────

export type Verdict = 'AVAILABLE' | 'UNAVAILABLE' | 'NEEDS_REVIEW';
export type TransactionStatus = 'JUDGEABLE' | 'CANCELED_OFFSET' | 'EXCLUDED';
export type JudgmentState = 'PROVISIONAL' | 'FINALIZED';
export type QuestionStatus = 'PENDING' | 'ANSWERED' | 'CANCELED';
export type RunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILED' | 'FAILED';
export type GateId = 'G0' | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6';
export type BookkeepingDuty = '복식부기' | '간편장부' | '추계';
export type CardIssuer = '국민' | '기업';
export type SourceType = '승인내역' | '청구내역' | '판별불가';

// ── 공통 ────────────────────────────────────────────

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
  homeOfficeRatio?: number;
}

export interface BusinessContextRef {
  id: string;
  version: number;
}

// ── 3.3 업로드 ──────────────────────────────────────

/** 파서 출력 15컬럼. 서버가 재계산하지 않으므로 그대로 보낸다. */
export interface ParsedTransaction {
  approvedAt: string;
  merchantRaw: string;
  amount: number;
  naturalKey: string;
  status: TransactionStatus;
  installmentMonths?: number;
  approvalNo?: string;
  bizNo?: string;
  branch?: string;
  branchRaw?: string;
  memo?: string;
  isAggregated?: boolean;
  needsReview?: boolean;
  reviewReason?: string;
  sourceCard?: 'ibk' | 'kb';
}

export interface UploadBatchRequest {
  sourceType: SourceType;
  cardIssuer: CardIssuer;
  periodStart: string;
  periodEnd: string;
  fileHash: string;
  transactions: ParsedTransaction[];
}

export interface UploadBatch {
  id: string;
  cardIssuer: CardIssuer;
  periodStart: string;
  periodEnd: string;
  transactionCount: number;
  skippedDuplicateCount: number;
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
  amount: number;
  installmentMonths: number;
  status: Coded<TransactionStatus>;
}

// ── 3.5 판정 실행 ───────────────────────────────────

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

// ── 3.6 판정 결과 ───────────────────────────────────

export interface Citation {
  statuteVersionId: number;
  statuteId: string;
}

export interface Judgment {
  id: string;
  transactionId: string;
  revision: number;
  verdict: Coded<Verdict>;
  /** 차단된 경우에만 값, 아니면 null (명세 2. Enum) */
  blockedAtGate: GateId | null;
  /** 계정과목. 불가 판정에서의 값은 명세 미정이라 null 허용 */
  account: string | null;
  /** 안분·한도 적용 후 인정 금액 */
  finalAmount: number | null;
  state: Coded<JudgmentState>;
  isInference: boolean;
  /** isInference=true 일 때만 값 존재 */
  unmatchedReason: string | null;
  attributes: Record<string, unknown>;
  /** 적용된 규칙 카드의 reason. AI 생성 아님. 속성형만 걸리거나 카드가 없으면 null */
  explanation: string | null;
  computedAt: string;
  citations: Citation[];
}

export interface VerdictSummary {
  count: number;
  finalAmount: number;
}

export interface JudgmentSummary {
  runId: string;
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

// ── 3.7 확인 질문 ───────────────────────────────────

export interface QuestionGroup {
  groupKey: string;
  questionIds: string[];
  count: number;
  totalAmount: number;
  questionText: string;
  options: string[];
}

export interface QuestionResponseRequest {
  questionIds: string[];
  answer: { value: string };
}

export interface QuestionResponseResult {
  answeredCount: number;
  runId: string;
}
