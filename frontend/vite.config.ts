import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 배포에서는 Caddy 가 /api/v1/* 를 백엔드로 넘긴다(deploy/Caddyfile). 개발 중에도 같은
// 경로를 쓰도록 여기서 프록시한다 — 화면 코드가 환경에 따라 달라지지 않게.
// 대상 서버는 VITE_API_TARGET 으로 바꾼다 (기본: 배포 서버).
const target = process.env.VITE_API_TARGET ?? 'https://ktc4-pusan-4.duckdns.org'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1': { target, changeOrigin: true, secure: true },
    },
  },
})
