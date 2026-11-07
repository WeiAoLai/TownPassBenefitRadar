FROM maven:3.9.11-eclipse-temurin-21 AS dev
WORKDIR /workspace
CMD ["mvn", "spring-boot:run"]

FROM dev AS build
COPY pom.xml ./
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B package -DskipTests

FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app
RUN useradd --system --uid 10001 spring
COPY --from=build /workspace/target/good-morning-*.jar app.jar
USER spring
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
