FROM node:22-alpine AS build

WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY rules/categories.yaml /rules/categories.yaml
# 카카오 REST API 키는 브라우저 인가 주소에 그대로 실리는 공개 값이라 GitHub variable 로 넘긴다. 키는 VITE_API=http 로 빌드한 실서버 화면에서만 쓴다. 그때 비우면 카카오 버튼을 숨기고, 목업 화면은 키 없이 늘 버튼을 보인다
ARG VITE_KAKAO_REST_API_KEY=""
ENV VITE_KAKAO_REST_API_KEY=$VITE_KAKAO_REST_API_KEY
RUN npm run build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/dist /srv
