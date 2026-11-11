/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'http' 면 실제 서버, 그 밖이면 인메모리 목업 (src/api/index.ts) */
  readonly VITE_API?: string;
  /** 카카오 REST API 키. 인가 URL 에 그대로 드러나는 공개 값이다. 비어 있으면 실서버에서 카카오 버튼을 숨긴다 */
  readonly VITE_KAKAO_REST_API_KEY?: string;
  /** 이 화면을 빌드한 커밋. 백엔드의 rulesCommitSha 와 같은 값을 배포가 넘긴다(deploy/web.Dockerfile). 로컬은 비어 있다 */
  readonly VITE_RULES_COMMIT_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
