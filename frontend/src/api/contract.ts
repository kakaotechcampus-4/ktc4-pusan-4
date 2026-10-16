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
  LoginRequest,
  OverrideRequest,
  Page,
  Question,
  QuestionGroup,
  QuestionPage,
  UnresolvedPage,
  QuestionResponseRequest,
  QuestionResponseResult,
  QuestionStatus,
  ReviewStatus,
  Statute,
  StoredBusinessContext,
  Transaction,
  TransactionInclusion,
  UploadBatch,
  UploadBatchCreated,
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
  /** 기본 true(현재 판정만). transactionId 와 false 로 쓰면 revision 이력 전체. runId 와 함께 쓰지 않는다 */
  latestOnly?: boolean;
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
  /**
   * 인증. 계약이 아직 api.md 에 없어 #139 에 적은 대로 가정한다 — 액세스 토큰은 Authorization 헤더(메모리),
   * 리프레시 토큰은 httpOnly 쿠키. 토큰은 이 층 안에만 있고 화면은 보지 않는다
   */
  auth: {
    /** 성공하면 이후 요청에 토큰이 붙는다. 이메일·비밀번호가 틀리면 401 */
    login(body: LoginRequest): Promise<void>;
    /** 새로고침 뒤 리프레시 쿠키로 로그인을 이어 간다. 이어 갈 수 없으면 false */
    restore(): Promise<boolean>;
    /** 이 브라우저의 토큰은 부르는 즉시 지운다. 서버 응답은 기다리지 않아도 된다 */
    logout(): Promise<void>;
    /** 재발급까지 실패해 로그인이 풀렸을 때 부른다. 해제 함수를 돌려준다 */
    onLost(listener: () => void): () => void;
  };
  /** 3.1 사용자 */
  users: {
    me(): Promise<User>;
    remove(): Promise<void>;
  };
  /** 3.2 사업자 Context */
  contexts: {
    create(body: BusinessContext): Promise<BusinessContextRef>;
    /** 문진 전이면 null (404) */
    current(): Promise<StoredBusinessContext | null>;
    list(): Promise<StoredBusinessContext[]>;
  };
  /** 3.3 업로드 */
  uploads: {
    /**
     * idempotencyKey 는 Idempotency-Key 헤더로 간다 (1.6). 화면이 들고 있다가
     * 응답을 못 받은 재시도에는 같은 키를 넘겨야 첫 응답이 다시 온다
     */
    create(body: UploadBatchRequest, idempotencyKey: string): Promise<UploadBatchCreated>;
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
    include(transactionId: string): Promise<TransactionInclusion>;
    /** userInclusion = EXCLUDED */
    exclude(transactionId: string): Promise<TransactionInclusion>;
  };
  /** 3.5 가맹점 분류 확인 */
  classificationReviews: {
    list(query?: ReviewQuery): Promise<UnresolvedPage<ClassificationReview>>;
    grouped(query?: ReviewQuery): Promise<UnresolvedPage<ClassificationReviewGroup>>;
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
    /**
     * 3.8 사용자 수정. 새 revision 을 만들고 이전 판정은 보존한다.
     * 현재 판정이 아니거나 판정 대상이 아닌 거래면 409 (#62). idempotencyKey 는 같은 내용을 다시 보낼 때만 재사용한다
     */
    override(judgmentId: string, body: OverrideRequest, idempotencyKey: string): Promise<Judgment>;
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
