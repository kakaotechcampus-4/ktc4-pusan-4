import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// 배포에서는 Caddy 가 /api/v1/* 를 백엔드로 넘긴다(deploy/caddy/Caddyfile). 개발 중에도 같은
// 경로를 쓰도록 여기서 프록시한다 — 화면 코드가 환경에 따라 달라지지 않게.
// 대상 서버는 VITE_API_TARGET 으로 바꾼다 (기본: 배포 서버).
//
// 설정 파일에는 .env 파일이 process.env 로 올라오지 않아 loadEnv 로 직접 읽는다.
// 안 읽으면 .env.local 에 대상을 적어도 프록시는 배포 서버를 보는데, 화면 쪽
// VITE_API=http 는 .env.local 로 먹어서 로컬을 보는 줄 알고 딴 서버를 재게 된다.

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_')
  const target =
    process.env.VITE_API_TARGET ?? env.VITE_API_TARGET ?? 'https://ktc4-pusan-4.duckdns.org'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/v1': { target, changeOrigin: true, secure: true },
      },
    },
  }
})
