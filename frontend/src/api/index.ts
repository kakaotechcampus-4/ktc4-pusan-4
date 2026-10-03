import type { Api } from './contract';
import { mockApi, mockSeedSession } from './mock';

export type { Api, PageQuery, TransactionQuery, JudgmentQuery, QuestionQuery } from './contract';
export { ApiRequestError } from './contract';

/**
 * 화면에서 쓰는 단일 진입점.
 * 백엔드가 준비되면 여기서 http 구현으로 바꾼다. 화면 코드는 그대로.
 */
export const api: Api = mockApi;

/** 개발용 세션 초기값. 목업일 때만 값이 있고 http 구현으로 바꾸면 null. */
export const seedSession: {
  batchId: string;
  contextRef: { id: string; version: number };
  runId: string;
} | null = mockSeedSession;
export { useApi } from './hooks';
