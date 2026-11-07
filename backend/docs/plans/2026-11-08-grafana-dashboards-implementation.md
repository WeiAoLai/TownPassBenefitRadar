# Grafana Chinese Dashboards Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add transaction-correct business metrics and two provisioned Chinese Grafana dashboards for demo and operations use.

**Architecture:** A `BusinessMetrics` component owns low-cardinality Micrometer counters and defers increments until transaction commit. Existing artwork create, like, unlike, and download services emit successful business events. Grafana reads technical and business metrics from Prometheus and recent activity/error logs from Loki.

**Tech Stack:** Spring Boot 4, Micrometer, Prometheus, Loki, Grafana provisioned dashboard JSON, JUnit 5, Mockito, Ruby JSON validation.

### Task 1: Add transaction-aware business metrics

**Files:**
- Create: `src/main/java/tw/gov/taipei/goodmorning/observability/BusinessMetrics.java`
- Create: `src/test/java/tw/gov/taipei/goodmorning/observability/BusinessMetricsTest.java`

**Steps:**
1. Write tests using `SimpleMeterRegistry` for metric names, `action` tags, immediate increments without a transaction, increment after commit, and no increment after rollback.
2. Run `mvn -Dtest=BusinessMetricsTest test` and verify compilation fails because the component does not exist.
3. Implement counter builders and transaction synchronization with no user or artwork labels.
4. Re-run the focused test and verify it passes.

### Task 2: Emit metrics only for effective successful operations

**Files:**
- Modify: `src/main/java/tw/gov/taipei/goodmorning/service/CreateArtworkService.java`
- Modify: `src/main/java/tw/gov/taipei/goodmorning/service/ArtworkLikeService.java`
- Modify: `src/main/java/tw/gov/taipei/goodmorning/service/DownloadArtworkService.java`
- Modify: corresponding service tests under `src/test/java/tw/gov/taipei/goodmorning/service/`

**Steps:**
1. Update constructor tests with a mocked `BusinessMetrics` and assert created/downloaded/like/unlike events only for successful, state-changing operations.
2. Run the three service test classes and verify the new assertions fail.
3. Inject `BusinessMetrics` and record events after successful service work; skip repeated likes/unlikes and author downloads.
4. Re-run focused tests and verify they pass.

### Task 3: Provision two meaningful Chinese dashboards

**Files:**
- Create: `monitoring/grafana/dashboards/good-morning-demo.json`
- Modify: `monitoring/grafana/dashboards/good-morning-backend.json`
- Create: `scripts/check-grafana-dashboards.rb`

**Steps:**
1. Add a validator requiring two unique dashboard UIDs, Chinese dashboard descriptions, non-empty Chinese panel descriptions, Prometheus and Loki datasource usage, business metrics, endpoint diagnosis, runtime/database panels, and error logs.
2. Run the validator against the current dashboard and verify it fails.
3. Add the Demo dashboard and replace the backend dashboard content with the Operations design and agreed thresholds.
4. Run the validator and parse both JSON files to verify they pass.

### Task 4: Extend monitoring smoke tests and documentation

**Files:**
- Modify: `scripts/monitoring-smoke-test.sh`
- Modify: `README.md`

**Steps:**
1. Extend the smoke script to verify both dashboard UIDs through the Grafana API and verify the business metric family exists on the private management endpoint after exercising an event.
2. Document dashboard purposes, URLs, metric semantics, thresholds, and regeneration/verification commands in Chinese.
3. Recreate the API and Grafana containers, run dashboard checks, focused tests, `mvn verify`, application smoke, and monitoring smoke.
4. Confirm Grafana APIs return both dashboards and Prometheus/Loki queries return data.
