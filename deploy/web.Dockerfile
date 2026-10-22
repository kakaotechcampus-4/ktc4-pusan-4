FROM node:22-alpine AS build

WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY rules/categories.yaml /rules/categories.yaml
# 비우면 목업 빌드, http 면 실제 서버를 부른다 (frontend/src/api/index.ts). 데모 배포는 http 로 빌드한다
ARG VITE_API=
ENV VITE_API=$VITE_API
RUN npm run build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/dist /srv
