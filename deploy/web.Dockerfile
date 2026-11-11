FROM node:22-alpine AS build

WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY rules/categories.yaml /rules/categories.yaml
# 관문 그래프, 용어집, 관리자 화면이 쓰는 원본. 빌드가 JSON 으로 바꿔 번들에 넣고, 못 읽으면 빌드가 멈춘다(scripts/rules-data.mjs)
COPY rules/cards /rules/cards
COPY rules/glossary.yaml /rules/glossary.yaml
COPY eval/cases /eval/cases
# 백엔드 이미지와 같은 커밋 SHA. 판정의 rulesCommitSha 와 다르면 화면이 「판정 당시 카드와 지금 카드가 다를 수 있다」고 알린다
ARG RULES_COMMIT_SHA=""
ENV VITE_RULES_COMMIT_SHA=$RULES_COMMIT_SHA
# 카카오 REST API 키는 브라우저 인가 주소에 그대로 실리는 공개 값이라 GitHub variable 로 넘긴다. 키는 VITE_API=http 로 빌드한 실서버 화면에서만 쓴다. 그때 비우면 카카오 버튼을 숨기고, 목업 화면은 키 없이 늘 버튼을 보인다
ARG VITE_KAKAO_REST_API_KEY=""
ENV VITE_KAKAO_REST_API_KEY=$VITE_KAKAO_REST_API_KEY
# 배포 번들을 실서버로 돌린다. 이 줄이 없으면 import.meta.env.VITE_API 가 비어
# api/index.ts 가 목업을 고른다 — 지금 배포 화면은 /api/v1 을 한 번도 부르지 않는다
RUN VITE_API=http npm run build

# 화면 파일만 담는다. 서버는 고정 버전 Caddy(compose.yaml web)가 맡고, deploy.sh 가 배포마다
# 이 이미지로 web-dist 볼륨에 파일을 옮긴다. 그래서 화면이 바뀌어도 Caddy 는 다시 뜨지 않는다
FROM busybox:1.37
COPY --from=build /src/dist /dist
COPY deploy/web-publish.sh /publish.sh
CMD ["sh", "/publish.sh"]
