import type {
  BulkAnswerRequest,
  BulkAnswerResult,
  BusinessContext,
  BusinessContextRef,
  ClassificationResponseRequest,
  ClassificationResponseResult,
  ClassificationReview,
  ClassificationReviewGroup,
  ClassificationStatus,
  EffectiveStatus,
  Judgment,
  JudgmentRun,
  JudgmentRunCreated,
  JudgmentRunFailure,
  JudgmentSummary,
  OverrideRequest,
  Page,
  Question,
  QuestionGroup,
  QuestionPage,
  QuestionResponseRequest,
  QuestionResponseResult,
  QuestionStatus,
  ReviewStatus,
  Statute,
  Transaction,
  UploadBatch,
  UploadBatchRequest,
  User,
  Verdict } from
'../types/domain';

/**
 * docs/api.md (v2) 의 엔드포인트 27개와 1:1.
 * 화면은 이 인터페이스만 본다. 지금은 mock 구현, 백엔드가 준비되면 http 구현으로 교체한다.
 */

export interface PageQuery {
  page?: number;
  size?: number;
}

export interface TransactionQuery extends PageQuery {
  batchId?: string;
  year?: number;
  month?: number;
  /** effectiveStatus 기준 */
  status?: EffectiveStatus;
  classificationStatus?: ClassificationStatus;
  verdict?: Verdict;
}

export interface JudgmentQuery extends PageQuery {
  batchId?: string;
  year?: number;
  transactionId?: string;
  runId?: string;
  verdict?: Verdict;
}

/** batchId · year · runId 중 정확히 하나. 0개거나 2개 이상이면 400 INVALID_SUMMARY_SCOPE */
export type SummaryScope =
{batchId: string;year?: never;runId?: never;} |
{year: number;batchId?: never;runId?: never;} |
{runId: string;batchId?: never;year?: never;};

export interface QuestionQuery extends PageQuery {
  batchId?: string;
  transactionId?: string;
  status?: QuestionStatus;
}

export interface ReviewQuery extends PageQuery {
  batchId?: string;
  status?: ReviewStatus;
}

export interface Api {
  /** 3.1 사용자 */
  users: {
    me(): Promise<User>;
    remove(): Promise<void>;
  };
  /** 3.2 사업자 Context */
  contexts: {
    create(body: BusinessContext): Promise<BusinessContextRef>;
    /** 문진 전이면 null (404) */
    current(): Promise<(BusinessContext & BusinessContextRef) | null>;
    list(): Promise<(BusinessContext & BusinessContextRef)[]>;
  };
  /** 3.3 업로드 */
  uploads: {
    /** Idempotency-Key 헤더는 구현이 붙인다 */
    create(body: UploadBatchRequest): Promise<UploadBatch>;
    list(query?: PageQuery): Promise<Page<UploadBatch>>;
    get(batchId: string): Promise<UploadBatch>;
    /** 배치와 파생 데이터(거래·판정·질문)를 함께 지운다 */
    remove(batchId: string): Promise<void>;
  };
  /** 3.4 거래 */
  transactions: {
    list(query?: TransactionQuery): Promise<Page<Transaction>>;
    get(transactionId: string): Promise<Transaction>;
    /** userInclusion = INCLUDED. 취소상계는 409 CANCELED_TRANSACTION_NOT_INCLUDABLE */
    include(transactionId: string): Promise<Transaction>;
    /** userInclusion = EXCLUDED */
    exclude(transactionId: string): Promise<Transaction>;
  };
  /** 3.5 가맹점 분류 확인 */
  classificationReviews: {
    list(query?: ReviewQuery): Promise<Page<ClassificationReview>>;
    grouped(query?: ReviewQuery): Promise<Page<ClassificationReviewGroup>>;
    /** 카테고리 확정. Run 이력이 있으면 해결된 거래만 재판정한다 */
    respond(body: ClassificationResponseRequest): Promise<ClassificationResponseResult>;
  };
  /** 3.6 판정 실행 */
  runs: {
    create(body: {batchId: string;contextId: string;}): Promise<JudgmentRunCreated>;
    get(runId: string): Promise<JudgmentRun>;
    /** 기술적 실패만. NEEDS_REVIEW 는 여기 오지 않는다 */
    failures(runId: string, query?: PageQuery): Promise<Page<JudgmentRunFailure>>;
  };
  /** 3.7 판정 결과 */
  judgments: {
    summary(scope: SummaryScope): Promise<JudgmentSummary>;
    list(query?: JudgmentQuery): Promise<Page<Judgment>>;
    get(judgmentId: string): Promise<Judgment>;
    /** 3.8 사용자 수정. 새 revision 을 만들고 이전 판정은 보존한다 */
    override(judgmentId: string, body: OverrideRequest): Promise<Judgment>;
    /** 활성 Override 해제 */
    removeOverride(overrideId: string): Promise<void>;
  };
  statutes: {
    get(statuteVersionId: number): Promise<Statute>;
  };
  /** 3.9~3.11 확인 질문 */
  questions: {
    list(query?: QuestionQuery): Promise<QuestionPage<Question>>;
    grouped(query?: QuestionQuery): Promise<QuestionPage<QuestionGroup>>;
    respond(body: QuestionResponseRequest): Promise<QuestionResponseResult>;
    /** 남은 꼬리 질문을 factType 단위로 한 번에 닫는다 */
    bulkAnswer(body: BulkAnswerRequest): Promise<BulkAnswerResult>;
  };
}

/** 1.3 에러 응답을 그대로 던진다 */
export class ApiRequestError extends Error {
  constructor(
  public readonly status: number,
  public readonly code: string,
  message: string,
  public readonly traceId = '')
  {
    super(message);
    this.name = 'ApiRequestError';
  }
}
