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
COPY profiles ./profiles
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
