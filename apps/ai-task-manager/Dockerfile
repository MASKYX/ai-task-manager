FROM eclipse-temurin:21-jdk-jammy AS build

WORKDIR /workspace
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw -B -DskipTests dependency:go-offline

COPY src/ src/
RUN ./mvnw -B -DskipTests package

FROM eclipse-temurin:21-jre-jammy

RUN useradd --system --uid 10001 --create-home appuser
WORKDIR /app
COPY --from=build --chown=appuser:appuser /workspace/target/ai-task-manager-*.jar app.jar

USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
