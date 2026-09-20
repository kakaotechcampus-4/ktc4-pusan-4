import type {
  BusinessContext,
  BusinessContextRef,
  Judgment,
  JudgmentRun,
  JudgmentRunCreated,
  JudgmentState,
  JudgmentSummary,
  OverrideRequest,
  Page,
  QuestionGroup,
  QuestionResponseRequest,
  QuestionResponseResult,
  QuestionStatus,
  Statute,
  Transaction,
  TransactionStatus,
  UploadBatch,
  UploadBatchRequest,
  User,
  Verdict } from
'../types/domain';

/**
 * API 명세 3.1~3.7 엔드포인트와 1:1.
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
  status?: TransactionStatus;
  verdict?: Verdict;
}

export interface JudgmentQuery extends PageQuery {
  transactionId?: string;
  verdict?: Verdict;
  state?: JudgmentState;
  /** 기본 true */
  latestOnly?: boolean;
  runId?: string;
}

export interface QuestionQuery extends PageQuery {
  runId?: string;
  status?: QuestionStatus;
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
    create(body: UploadBatchRequest): Promise<UploadBatch>;
    list(query?: PageQuery): Promise<Page<UploadBatch>>;
    get(batchId: string): Promise<UploadBatch>;
    remove(batchId: string): Promise<void>;
  };
  /** 3.4 거래 */
  transactions: {
    list(query?: TransactionQuery): Promise<Page<Transaction>>;
    get(transactionId: string): Promise<Transaction>;
    setStatus(transactionId: string, status: TransactionStatus): Promise<Transaction>;
  };
  /** 3.5 판정 실행 */
  runs: {
    create(body: {batchId: string;contextId: string;}): Promise<JudgmentRunCreated>;
    get(runId: string): Promise<JudgmentRun>;
  };
  /** 3.6 판정 결과 */
  judgments: {
    summary(runId: string): Promise<JudgmentSummary>;
    list(query?: JudgmentQuery): Promise<Page<Judgment>>;
    get(judgmentId: string): Promise<Judgment>;
    override(judgmentId: string, body: OverrideRequest): Promise<Judgment>;
  };
  statutes: {
    get(statuteVersionId: number): Promise<Statute>;
  };
  /** 3.7 확인 질문 */
  questions: {
    grouped(query?: QuestionQuery): Promise<Page<QuestionGroup>>;
    respond(body: QuestionResponseRequest): Promise<QuestionResponseResult>;
  };
}

/** 명세 1. 공통 에러 응답을 그대로 던진다 */
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
