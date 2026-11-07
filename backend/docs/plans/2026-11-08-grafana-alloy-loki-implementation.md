# Grafana Alloy and Loki Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Collect the `good-morning` Docker Compose logs with Grafana Alloy, retain them in Loki for seven days, and query them through the existing Grafana instance.

**Architecture:** Alloy discovers only containers labeled with Compose project `good-morning`, adds stable low-cardinality labels, and pushes their stdout/stderr logs to a single-node Loki instance. Loki stores TSDB chunks in a named volume with 168-hour retention, while Grafana provisions Loki as a non-default datasource over the private Compose network.

**Tech Stack:** Docker Compose, Grafana Alloy v1.21.0, Grafana Loki 3.7.0, Grafana 13.2.1, Bash, LogQL.

### Task 1: Add configuration validation fixtures

**Files:**
- Create: `backend/monitoring/loki/config.yml`
- Create: `backend/monitoring/alloy/config.alloy`

**Step 1:** Add a single-node Loki filesystem/TSDB configuration with compactor retention enabled and a 168-hour default retention period.

**Step 2:** Add an Alloy pipeline using `discovery.docker`, `discovery.relabel`, `loki.source.docker`, and `loki.write`; keep only `good-morning` Compose containers and expose stable project/service/container labels.

**Step 3:** Validate both configurations with their pinned container images.

Run:

```bash
docker run --rm -v "$PWD/monitoring/loki/config.yml:/etc/loki/config.yml:ro" grafana/loki:3.7.0 -config.file=/etc/loki/config.yml -verify-config
docker run --rm -v "$PWD/monitoring/alloy/config.alloy:/etc/alloy/config.alloy:ro" grafana/alloy:v1.21.0 fmt --test /etc/alloy/config.alloy
```

Expected: both commands exit 0.

### Task 2: Wire the logging services into Compose and Grafana

**Files:**
- Modify: `backend/compose.yaml`
- Create: `backend/monitoring/grafana/provisioning/datasources/loki.yml`
- Modify: `backend/.env.example`

**Step 1:** Add Loki with a private port, persistent `loki-data` volume, and the checked-in config.

**Step 2:** Add Alloy with a read-only Docker socket, persistent `alloy-data` volume, checked-in config, and private debugging UI.

**Step 3:** Provision Grafana datasource UID `loki` at `http://loki:3100` and make Grafana start after Loki.

**Step 4:** Add `LOKI_RETENTION=168h` documentation/default and validate the rendered Compose model.

Run: `docker compose config --quiet`

Expected: exit 0.

### Task 3: Extend smoke coverage and operations documentation

**Files:**
- Modify: `backend/scripts/monitoring-smoke-test.sh`
- Modify: `backend/README.md`

**Step 1:** Extend the monitoring smoke test to wait for Loki and Alloy through the Compose network and verify Grafana reports the Loki datasource healthy.

**Step 2:** Send a request with a deterministic `X-Request-ID`, then query Loki until that ID is present in an API container log.

**Step 3:** Document Grafana Explore queries, retention behavior, volume lifecycle, EC2/ALB exposure, and the correct test command when reusing the running API container.

### Task 4: Run end-to-end verification

**Files:**
- Test: `backend/compose.yaml`
- Test: `backend/scripts/monitoring-smoke-test.sh`

**Step 1:** Recreate Loki, Alloy, and Grafana, then check Compose service state.

Run: `docker compose up -d --force-recreate loki alloy grafana`

Expected: services stay running and readiness checks succeed.

**Step 2:** Run application and monitoring smoke tests.

Run:

```bash
bash scripts/smoke-test.sh
bash scripts/monitoring-smoke-test.sh
```

Expected: both scripts exit 0 and the monitoring output confirms the trace ID was found in Loki.

**Step 3:** Run the full backend test suite without deployment Flyway overrides.

Run:

```bash
docker compose exec -T api env -u SPRING_FLYWAY_URL -u SPRING_FLYWAY_USER -u SPRING_FLYWAY_PASSWORD mvn verify
```

Expected: 80 tests, 0 failures, 0 errors.

**Step 4:** Review the diff, commit the implementation, push the branch, and verify local/remote commit IDs match.
