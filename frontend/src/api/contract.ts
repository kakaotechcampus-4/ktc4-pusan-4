import type {
  AssistantChatRequest,
  AssistantChatResponse,
  BulkAnswerRequest,
  BulkAnswerResult,
  BusinessContext,
  BusinessContextRef,
  BugReportRequest,
  ChangePasswordRequest,
  EmailVerificationConfirmRequest,
  EmailVerificationConfirmed,
  EmailVerificationRequest,
  ClassificationResponseRequest,
  ClassificationResponseResult,
  ClassificationReview,
  ClassificationReviewGroup,
  ClassificationStatus,
  EffectiveStatus,
  HandoffNote,
  HandoffNoteRequest,
  Judgment,
  JudgmentRun,
  JudgmentRunCreated,
  JudgmentExportRow,
  JudgmentRunFailure,
  JudgmentSummary,
  KakaoLoginRequest,
  LimitYear,
  LoginRequest,
  OverrideRequest,
  PasswordResetCompleteRequest,
  Page,
  Progress,
  Question,
  QuestionGroup,
  QuestionPage,
  UnresolvedPage,
  QuestionResponseRequest,
  QuestionResponseResult,
  QuestionStatus,
  QuestionSuggestion,
  ReviewStatus,
  RuleCandidate,
  RuleCandidateStatus,
  SignupRequest,
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
import type { SessionEndReason } from '../auth/session';

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
  /** true 면 답변 대기만, false 면 답변 대기를 뺀다. 없으면 거르지 않는다 */
  awaiting?: boolean;
  /** 기본 COMPUTED_AT(판정한 시각 최근 순). APPROVED_AT 은 승인일 최근 순 */
  sort?: 'COMPUTED_AT' | 'APPROVED_AT';
}

/** batchId · year 중 정확히 하나. 0개거나 2개면 400 INVALID_EXPORT_SCOPE */
export type ExportScope =
{batchId: string;year?: never;} |
{year: number;batchId?: never;};

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

export interface RuleCandidateQuery extends PageQuery {
  status?: RuleCandidateStatus;
}

export interface Api {
  /**
   * 인증 (api.md 1.1). 액세스 토큰은 Authorization 헤더(메모리), 리프레시 토큰은 httpOnly 쿠키.
   * 토큰은 이 층 안에만 있고 화면은 보지 않는다
   */
  auth: {
    /** 성공하면 이후 요청에 토큰이 붙는다. 이메일·비밀번호가 틀리면 401 */
    login(body: LoginRequest): Promise<void>;
    /** 가입 인증 코드를 메일로 보낸다 (#193). 코드는 5분 동안 쓸 수 있고, 다시 받기는 60초에 한 번이다 */
    requestEmailVerification(body: EmailVerificationRequest): Promise<void>;
    /** 코드를 확인하고 가입에 쓸 토큰을 받는다 */
    confirmEmailVerification(body: EmailVerificationConfirmRequest): Promise<EmailVerificationConfirmed>;
    /** 가입하고 바로 로그인한다. 성공하면 login 과 같다 */
    signup(body: SignupRequest): Promise<void>;
    /** 비밀번호 재설정 코드를 메일로 보낸다. 가입하지 않은 이메일도 성공(202)이고 메일만 가지 않는다 */
    requestPasswordReset(body: EmailVerificationRequest): Promise<void>;
    /** 재설정 코드를 확인하고 재설정에 쓸 토큰을 받는다. 오류는 가입 코드 확인과 같다 */
    confirmPasswordReset(body: EmailVerificationConfirmRequest): Promise<EmailVerificationConfirmed>;
    /** 새 비밀번호로 바꾸고 그 사용자의 모든 로그인을 끊는다. 로그인은 하지 않는다 */
    completePasswordReset(body: PasswordResetCompleteRequest): Promise<void>;
    /** 카카오 인가 코드로 로그인한다 (#176). 처음 온 회원이면 서버가 계정을 만든다 */
    kakao(body: KakaoLoginRequest): Promise<void>;
    /** 새로고침 뒤 리프레시 쿠키로 로그인을 이어 간다. 이어 갈 수 없으면 false */
    restore(): Promise<boolean>;
    /** 이 브라우저의 토큰은 부르는 즉시 지운다. 서버 응답은 기다리지 않아도 된다 */
    logout(): Promise<void>;
    /** 로그인이 사용자 손을 거치지 않고 풀렸을 때 그 이유와 함께 부른다(auth/session.ts). 해제 함수를 돌려준다 */
    onLost(listener: (reason: SessionEndReason) => void): () => void;
  };
  /** 3.1 사용자 */
  users: {
    me(): Promise<User>;
    remove(): Promise<void>;
    /** 비밀번호를 바꾸고 지금 기기를 포함한 모든 로그인을 끊는다. 카카오 계정은 409 PASSWORD_NOT_SET */
    changePassword(body: ChangePasswordRequest): Promise<void>;
  };
  /** 3.16 버그 신고. 로그인한 사람만, 한 시간에 5건. 메일 계정이 없는 서버는 503 BUG_REPORT_UNAVAILABLE */
  bugReports: {
    create(body: BugReportRequest): Promise<void>;
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
    /**
     * 이 사용자의 진행 중인(QUEUED, RUNNING) 실행. 없으면 null(204).
     * 진행 화면을 떠났다가 돌아오거나, 판정 시작을 막을 때 쓴다
     */
    active(): Promise<JudgmentRun | null>;
    /** 기술적 실패만. NEEDS_REVIEW 는 여기 오지 않는다 */
    failures(runId: string, query?: PageQuery): Promise<Page<JudgmentRunFailure>>;
  };
  /** 3.7 판정 결과 */
  judgments: {
    summary(scope: SummaryScope): Promise<JudgmentSummary>;
    list(query?: JudgmentQuery): Promise<Page<Judgment>>;
    get(judgmentId: string): Promise<Judgment>;
    /**
     * 세무사에게 넘길 내보내기(#214). 현재 판정 전부를 페이지 없이 준다. 다른 사용자의 batchId 면 빈 목록.
     * limits 는 summary 의 limits 와 같다(#226)
     */
    export(scope: ExportScope): Promise<{items: JudgmentExportRow[];limits: LimitYear[];}>;
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
    /** 다른 업로드에서 같은 질문에 한 답 (명세 3.1, api.md GET /questions/suggestions) */
    suggestions(batchId: string): Promise<{items: QuestionSuggestion[];}>;
  };
  /**
   * 비서 Really (docs/agent-secretary.md 9·10장). 중계는 api.md POST /assistant/chat.
   * 검증 실패는 400, 맥락의 업로드·거래가 없거나 남의 것이면 404 BATCH_NOT_FOUND·TRANSACTION_NOT_FOUND,
   * 한도는 429 ASSISTANT_RATE_LIMITED + Retry-After(ApiRequestError.retryAfter), AI 서버 장애는 503
   */
  assistant: {
    chat(body: AssistantChatRequest): Promise<AssistantChatResponse>;
  };
  progress: {
    get(batchId: string): Promise<Progress>;
  };
  handoffNotes: {
    list(): Promise<HandoffNote[]>;
    create(body: HandoffNoteRequest): Promise<HandoffNote>;
  };
  /** 관리자 (M1, api.md 3.15) */
  admin: {
    ruleCandidates: {
      list(query?: RuleCandidateQuery): Promise<Page<RuleCandidate>>;
      approve(candidateId: number): Promise<RuleCandidate>;
      reject(candidateId: number): Promise<RuleCandidate>;
    };
  };
}

/**
 * 마지막으로 받은 오류 응답의 traceId. 버그 신고에 실어 서버 로그와 바로 잇는다 (#225).
 * 적는 쪽은 http.ts 다. 로그인 실패나 신고 자체의 실패는 적지 않고, 로그인, 로그아웃, 신고를 보낸 뒤에는 지운다
 */
let lastTraceId: string | null = null;

export const lastErrorTraceId = () => lastTraceId;
export const rememberTraceId = (traceId: string | null) => {
  lastTraceId = traceId;
};

/** 1.3 에러 응답을 그대로 던진다 */
export class ApiRequestError extends Error {
  constructor(
  public readonly status: number,
  public readonly code: string,
  message: string,
  public readonly traceId = '',
  /** 429 의 Retry-After(초). 없으면 undefined */
  public readonly retryAfter?: number,
  /** 409 RUN_ALREADY_ACTIVE 의 진행 중인 판정 실행 id (#228). 그 밖에는 undefined */
  public readonly runId?: string)
  {
    super(message);
    this.name = 'ApiRequestError';
  }
}
