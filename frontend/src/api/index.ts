import type { Api } from './contract';
import { httpApi } from './http';
import { MOCK_PASSWORD, mockApi, mockSeedSession } from './mock';

export type { Api, PageQuery, TransactionQuery, JudgmentQuery, QuestionQuery } from './contract';
export { ApiRequestError } from './contract';

/**
 * 화면에서 쓰는 단일 진입점.
 * `VITE_API=http` 면 실제 서버, 아니면 인메모리 목업이다. 화면 코드는 그대로.
 * 개발 중 전환: `VITE_API=http npm run dev`
 */
const useHttp = import.meta.env.VITE_API === 'http';

export const api: Api = useHttp ? httpApi : mockApi;

/** 목업 모드인가. 가짜 데이터로만 해 볼 수 있는 것(샘플 파일)을 실제 서버에서 숨길 때 쓴다 */
export const isMock = !useHttp;

/** 개발용 세션 초기값. 목업일 때만 값이 있고 실제 서버에서는 null 이다. */
export const seedSession: {
  batchId: string;
  contextRef: { id: string; version: number };
  runId: string;
} | null = useHttp ? null : mockSeedSession;

/** 목업 로그인 비밀번호. 목업일 때만 값이 있다. 로그인 화면의 목업 전용 버튼과 안내가 쓴다 */
export const mockPassword: string | null = useHttp ? null : MOCK_PASSWORD;
export { invalidateAll, useApi } from './hooks';

// mockControls 는 여기서 다시 내보내지 않는다. 내보내면 실제 서버 빌드에서도
// 목업 모듈 전체가 번들에 남는다. 쓰는 쪽(검증 하네스)은 './mock' 에서 직접 가져온다.
