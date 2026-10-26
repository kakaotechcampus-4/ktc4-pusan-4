FROM eclipse-temurin:21-jdk-jammy AS build

WORKDIR /src
COPY backend ./backend
RUN bash backend/gradlew -p backend bootJar --no-daemon

FROM eclipse-temurin:21-jre-jammy
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /src/backend/build/libs/*.jar app.jar
COPY rules ./rules
# 판정마다 남는 rules_commit_sha (application.yml app.rules.*). .git 은 dockerignore 라 빌드 안에서 읽을 수 없어
# 릴리스 워크플로가 커밋을 넘긴다. 그 커밋을 checkout 하면 판정 당시 rules/ 를 되찾을 수 있다.
ARG RULES_COMMIT_SHA=local
ENV APP_RULES_DIR=/app/rules
ENV APP_RULES_COMMIT_SHA=$RULES_COMMIT_SHA
COPY profiles ./profiles
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
