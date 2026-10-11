/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'http' 면 실제 서버, 그 밖이면 인메모리 목업 (src/api/index.ts) */
  readonly VITE_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
