# Good Morning Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete container-only Spring Boot backend defined by `openapi.yaml` and the backend technical design.

**Architecture:** A Spring Boot 4.1.2 REST API runs in a development container and connects to MariaDB 11.4 plus a local S3-compatible LocalStack container. Application code is separated into `controller`, `dto`, `service`, `entity`, and `repository` packages, with supporting `config`, `security`, and `exception` packages. Flyway owns the schema, JPA owns persistence mapping, and AWS SDK 2.x owns S3 access. Controllers exchange DTOs rather than entities. Demo authentication is isolated behind a request filter so a future SSO adapter can replace it without changing business services. `GlobalExceptionHandler` is the single REST error mapping boundary.

**Tech Stack:** Java 21, Spring Boot 4.1.2, Maven, Spring Data JPA, MariaDB 11.4, Flyway, AWS SDK for Java 2.x, ZXing, springdoc-openapi 3.2.0, JUnit 5, Testcontainers, Docker Compose, LocalStack.

**Execution rule:** Run Maven, Java, MariaDB, LocalStack, Flyway, and all tests only in containers. Do not install or invoke a host JDK or Maven.

---

### Task 1: Initialize Git and container-only project scaffold

**Files:**
- Create: `.gitignore`
- Create: `.dockerignore`
- Create: `.env.example`
- Create: `pom.xml`
- Create: `Dockerfile`
- Create: `compose.yaml`
- Create: `src/main/java/tw/gov/taipei/goodmorning/GoodMorningApplication.java`
- Create: `src/main/resources/application.yml`
- Create: `src/test/java/tw/gov/taipei/goodmorning/GoodMorningApplicationTest.java`

**Step 1: Initialize repository and preserve the agreed documents**

Run:

```bash
git init -b main
git add good-morning.md openapi.yaml docs scripts src/main/resources/db/migration
git commit -m "docs: define backend contract and schema"
```

Expected: a clean initial commit containing only existing requirements and contracts.

**Step 2: Write the failing application context test**

```java
package tw.gov.taipei.goodmorning;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class GoodMorningApplicationTest {
    @Test
    void contextLoads() {}
}
```

**Step 3: Create minimal Maven and application scaffold**

- Parent: `org.springframework.boot:spring-boot-starter-parent:4.1.2`.
- Java: 21.
- Dependencies: web, validation, data-jpa, actuator, security, Flyway core, Flyway MySQL, MariaDB driver, AWS SDK S3, ZXing, springdoc 3.2.0, test starter, Testcontainers MariaDB.
- Disable Hibernate DDL mutation with `ddl-auto: validate`.
- Configure UTC JDBC session and `/actuator/health`.

**Step 4: Create dev/build/runtime Docker targets and Compose services**

- `api`: Maven + Temurin 21 dev image, source bind mount, Maven cache volume.
- `mariadb`: `mariadb:11.4`, health check, named data volume.
- `localstack`: S3 only, named data volume, test-only credentials.
- Mount the Docker socket into the `api` service for Testcontainers.

**Step 5: Run the test entirely in a container**

Run:

```bash
docker compose run --rm api mvn test -Dtest=GoodMorningApplicationTest
```

Expected: `BUILD SUCCESS`, 1 test, 0 failures.

**Step 6: Commit**

```bash
git add .gitignore .dockerignore .env.example pom.xml Dockerfile compose.yaml src
git commit -m "chore: scaffold containerized Spring Boot service"
```

---

### Task 2: Validate Flyway schema against MariaDB

**Files:**
- Modify: `src/main/resources/db/migration/V1__create_schema.sql`
- Create: `src/test/java/tw/gov/taipei/goodmorning/repository/FlywayMigrationTest.java`
- Modify: `scripts/check-db-schema.sh`

**Step 1: Write a failing Testcontainers migration test**

The test starts `mariadb:11.4`, runs Flyway, and asserts the five tables exist:

```java
assertThat(tableNames).containsExactlyInAnyOrder(
    "users", "backgrounds", "policies", "artworks", "artwork_likes"
);
```

It must also inspect `policies.start_date`, `policies.end_date`, and the unique like constraint.

**Step 2: Run and verify failure**

```bash
docker compose run --rm api mvn test -Dtest=FlywayMigrationTest
```

Expected: FAIL until Testcontainers socket wiring and migration configuration are correct.

**Step 3: Make the minimal schema/configuration corrections**

Keep `V1__create_schema.sql` authoritative. Do not let Hibernate create tables.

**Step 4: Run structural and database tests**

```bash
docker compose run --rm api bash -lc 'bash scripts/check-db-schema.sh && mvn test -Dtest=FlywayMigrationTest'
```

Expected: both checks pass.

**Step 5: Commit**

```bash
git add src/main/resources/db/migration src/test scripts/check-db-schema.sh compose.yaml
git commit -m "test: verify Flyway schema on MariaDB"
```

---

### Task 3: Map entities and repositories

**Files:**
- Create: entities under `src/main/java/tw/gov/taipei/goodmorning/entity`
- Create: matching Spring Data repositories under `src/main/java/tw/gov/taipei/goodmorning/repository`
- Create: repository integration tests under `src/test/java/.../repository`

**Steps:**

1. Write failing repository tests for unique SSO subject, currently available policies, artwork paging, and one-like-per-user.
2. Run the tests in `api` container and verify the expected failures.
3. Implement minimal JPA mappings with `Instant` timestamps and `LocalDate` policy dates.
4. Add repository queries for `is_active = true AND start_date <= today AND end_date >= today`.
5. Run repository tests and full test suite.
6. Commit with `feat: add persistence model and repositories`.

---

### Task 4: Implement Demo authentication and current-user API

**Files:**
- Create: `config/DemoUserProperties.java`
- Create: `security/DemoUserFilter.java`
- Create: `security/CurrentUser.java`
- Create: `security/SecurityConfiguration.java`
- Create: `service/CurrentUserService.java`
- Create: `controller/MeController.java`
- Create: current-user records under `dto`
- Create: controller and filter tests

**Steps:**

1. Write failing MockMvc tests: missing header → 401; unknown alias → 401; valid alias → user auto-created; no client owner ID is accepted.
2. Implement allowlist binding from `APP_AUTH_DEMO_USERS_*` settings.
3. Resolve/create local user by `sso_subject` and attach a typed principal.
4. Implement `GET /api/v1/me`, including artwork count and nullable highest badge.
5. Run targeted tests, then all tests.
6. Commit with `feat: add demo user authentication`.

---

### Task 5: Implement badge rules, backgrounds, and policies

**Files:**
- Create: services under `service`
- Create: `controller/BackgroundController.java`
- Create: `controller/PolicyController.java`
- Create: DTO records for `Badge`, `Background`, and `Policy` under `dto`
- Create: unit and MockMvc tests

**Steps:**

1. Write parameterized badge boundary tests for `0, 1, 2, 4, ..., 512`.
2. Write tests that locked backgrounds are returned with `unlocked=false`.
3. Write policy tests using `Clock` fixed near start/end boundaries in `Asia/Taipei`.
4. Implement category, filtered list, and random policy APIs.
5. Ensure expired/future/inactive policies never appear.
6. Run tests and commit with `feat: add badge background and policy APIs`.

---

### Task 6: Implement S3 storage and PNG validation

**Files:**
- Create: `service/ObjectStorage.java`
- Create: `repository/s3/S3ObjectStorage.java`
- Create: `config/S3Properties.java`
- Create: `service/PngArtworkValidator.java`
- Create: unit tests and LocalStack integration test
- Create: `docker/localstack/init-s3.sh`

**Steps:**

1. Write failing tests for invalid signature, invalid dimensions, non-PNG data, and files over 10 MB.
2. Write a failing LocalStack test for put, presign, get, and delete.
3. Implement validation with `ImageIO` and enforce exactly `1080 x 1080`.
4. Implement AWS SDK 2.x client with optional local endpoint override and path-style access.
5. Generate object keys as `artworks/{ownerId}/{uuid}.png`.
6. Run unit/integration tests and commit with `feat: add S3 artwork storage`.

---

### Task 7: Implement artwork creation and compensation

**Files:**
- Create: `service/CreateArtworkService.java`
- Create: `controller/ArtworkController.java`
- Create: request/response records under `dto`
- Create: service and MockMvc tests

**Steps:**

1. Write failing tests for locked background, inactive policy, expired policy, invalid image, S3 failure, and DB failure after S3 success.
2. Implement multipart request handling matching `openapi.yaml`.
3. Upload S3 first, then insert Artwork in a MariaDB transaction.
4. On DB failure, perform best-effort S3 delete and preserve the original exception.
5. Snapshot slogan and policy source URL.
6. Return 201 with `Location` header and artwork DTO.
7. Run tests and commit with `feat: create immutable artworks`.

---

### Task 8: Implement artwork lists and details

**Files:**
- Modify: `controller/ArtworkController.java`
- Create: `service/ArtworkQueryService.java`
- Create: paging and mapping tests

**Steps:**

1. Write failing tests for public list, `/v1/me/artworks`, detail, 404, stable sorting, and max page size.
2. Implement `created_at DESC, id DESC` paging.
3. Add 15-minute presigned image URLs, `likedByMe`, `ownedByMe`, and owner badge.
4. Run tests and commit with `feat: add artwork query APIs`.

---

### Task 9: Implement idempotent likes

**Files:**
- Create: `service/ArtworkLikeService.java`
- Modify: `controller/ArtworkController.java`
- Create: transaction and concurrency tests

**Steps:**

1. Write failing tests for PUT twice, DELETE twice, author conflict, and concurrent likes.
2. Insert/delete `artwork_likes` and atomically update `like_count` in one transaction.
3. Return the final `LikeState` for both PUT and DELETE.
4. Run tests and commit with `feat: add idempotent artwork likes`.

---

### Task 10: Implement QR download and download counting

**Files:**
- Create: `service/QrCodeComposer.java`
- Create: `service/DownloadArtworkService.java`
- Modify: `controller/ArtworkController.java`
- Create: image/QR decoding tests

**Steps:**

1. Write a failing test that decodes the generated QR and equals the snapshotted source URL.
2. Write tests for right-bottom placement, 1080-square output, author no-count, and non-author atomic increment.
3. Implement ZXing generation with a white quiet-zone panel at approximately 20% short-edge width.
4. Stream `image/png` with `Content-Disposition`.
5. Run tests and commit with `feat: add QR artwork downloads`.

---

### Task 11: Implement leaderboard and errors

**Files:**
- Create: `service/LeaderboardService.java`
- Create: `controller/LeaderboardController.java`
- Create: native ranking projection/query
- Create: `exception/GlobalExceptionHandler.java`
- Create: ranking and ProblemDetail tests

**Steps:**

1. Write failing ranking tests for `score=max(likes, downloads)` and ranks `1,2,2,4`.
2. Implement `RANK() OVER` query capped at 100 entries.
3. Add stable tie display ordering without affecting rank.
4. Map validation, auth, forbidden, not-found, conflict, payload, and dependency errors to `ProblemDetail` with `code` and `traceId`.
5. Run tests and commit with `feat: add leaderboard and API errors`.

---

### Task 12: OpenAPI, Nginx, and end-to-end verification

**Files:**
- Modify: `openapi.yaml`
- Create: `nginx/nginx.conf`
- Modify: `compose.yaml`
- Create: `scripts/smoke-test.sh`
- Modify: `README.md`

**Steps:**

1. Add a contract test that generated endpoints/schemas match the checked-in OpenAPI paths and core fields.
2. Configure Nginx `/api`, upload size, health check, and stricter download rate limit.
3. Start the full stack:

```bash
docker compose up --build -d
```

4. Verify health, Flyway, current user, backgrounds, policies, artwork creation, like/unlike, leaderboard, QR download, and presigned image retrieval via `scripts/smoke-test.sh`.
5. Run the complete suite:

```bash
docker compose run --rm api mvn verify
ruby scripts/check-openapi.rb
bash scripts/check-db-schema.sh
docker compose ps
```

Expected: Maven `BUILD SUCCESS`, contract checks pass, and all services are healthy.

6. Check secrets and tracked files:

```bash
git diff --check
rg -n 'AKIA[0-9A-Z]{16}|AWS_SECRET_ACCESS_KEY\s*=\s*[^#[:space:]]+' .
```

Expected: no credential matches.

7. Commit with `chore: complete containerized backend MVP`.
