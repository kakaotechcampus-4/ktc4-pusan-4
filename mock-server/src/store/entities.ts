import type { ClassificationStatusCode, QuestionStatusCode, ReviewStatusCode, SourceStatusCode, Verdict } from '../common/coded';

export interface UserEntity {
  id: string;
  email: string;
  createdAt: string;
}

export type BookkeepingDuty = '복식부기' | '간편장부' | '추계';

export interface BusinessContextEntity {
  id: string;
  userId: string;
  version: number;
  industryCode: string;
  prevYearRevenue: number;
  businessOpenDate: string;
  bookkeepingDuty: BookkeepingDuty;
  hasEmployee: boolean;
  homeOfficeRatio: number | null;
  createdAt: string;
}

export interface UploadBatchEntity {
  id: string;
  userId: string;
  sourceType: string;
  cardIssuer: string;
  periodStart: string;
  periodEnd: string;
  fileHash: string;
  transactionCount: number;
  skippedDuplicateCount: number;
  classificationPendingCount: number;
  createdAt: string;
}

export type UserInclusion = 'AUTO' | 'INCLUDED' | 'EXCLUDED';

export interface TransactionEntity {
  id: string;
  batchId: string;
  approvedAt: string;
  merchantRaw: string;
  merchantNorm: string;
  merchantCategory: string;
  classificationStatus: ClassificationStatusCode;
  amount: number;
  installmentMonths: number;
  naturalKey: string;
  sourceStatus: SourceStatusCode;
  userInclusion: UserInclusion;
}

export interface ClassificationReviewEntity {
  id: string;
  batchId: string;
  transactionId: string;
  merchantRaw: string;
  merchantNorm: string;
  status: ReviewStatusCode;
  suggestedCategories: string[];
  createdAt: string;
  resolvedAt: string | null;
}

export interface JudgmentRunEntity {
  id: string;
  batchId: string;
  contextId: string;
  contextVersion: number;
  totalCount: number;
  failedCount: number;
  startedAt: string | null;
  completedAt: string | null;
  /** GET 호출 횟수. poll 기반 진행률 시뮬레이션에만 쓰는 내부 필드 (API로 노출 안 함). */
  pollCount: number;
}

export type JudgmentOriginType = 'RUN' | 'USER_FACT' | 'CLASSIFICATION_REVIEW' | 'OVERRIDE';

export interface CitationEntity {
  statuteVersionId: number;
  statuteId: string;
}

export interface JudgmentEntity {
  id: string;
  transactionId: string;
  revision: number;
  origin: { type: JudgmentOriginType; id: string };
  runId: string | null;
  verdict: Verdict;
  /** 룰엔진 판정 범위 밖(핸드오프)인지. verdict=NEEDS_REVIEW일 때만 true일 수 있다. */
  outOfScope: boolean;
  blockedAtGate: string | null;
  account: string | null;
  finalAmount: number | null;
  isInference: boolean;
  unmatchedReason: string | null;
  attributes: Record<string, unknown>;
  ruleCardId: string | null;
  ruleCardVersion: number | null;
  appliedRuleIds: string[];
  rulesCommitSha: string;
  userContextVersion: number;
  explanation: string | null;
  computedAt: string;
  citations: CitationEntity[];
}

export interface UserFactEntity {
  id: string;
  userId: string;
  batchId: string;
  scopeKey: string;
  factType: string;
  value: string;
  version: number;
  createdAt: string;
}

export interface JudgmentOverrideEntity {
  id: string;
  sourceJudgmentId: string;
  toVerdict: Verdict;
  reason: string;
  active: boolean;
  createdAt: string;
  releasedAt: string | null;
}

export interface QuestionEntity {
  id: string;
  batchId: string;
  transactionId: string;
  groupKey: string;
  factType: string;
  questionText: string;
  options: string[];
  status: QuestionStatusCode;
  answeredFactId: string | null;
  createdAt: string;
  answeredAt: string | null;
}

export interface StatuteEntity {
  statuteVersionId: number;
  statuteId: string;
  title: string;
  hierarchy: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceUrl: string;
  body: string;
}

export interface IdempotencyRecord {
  payloadHash: string;
  status: 'COMPLETED' | 'DELETED';
  batchId: string;
  body: unknown;
  expiresAt: number;
}
