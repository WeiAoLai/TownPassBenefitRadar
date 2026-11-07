# k6 Mixed Load Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add separate local and AWS k6 entry scripts backed by one configurable mixed read/write workload and enforce agreed performance thresholds.

**Architecture:** Two thin entry modules choose the target URL and summary file. A shared module defines ramping-vus scenarios, setup data, read and full artwork journeys, checks, request tags, and thresholds. Docker Compose performance-profile services run the pinned official k6 image.

**Tech Stack:** Grafana k6 2.3.0, Docker Compose, JavaScript modules, Spring Boot HTTP API, LocalStack S3.

### Task 1: Define the k6 contract and shared workload

**Files:**
- Create: `scripts/check-k6.rb`
- Create: `performance/k6/workload.js`
- Create: `performance/k6/fixtures/artwork.png.b64`

**Steps:**
1. Add a failing checker for two entry scripts, shared ramping scenarios, 80/20 VUs, thresholds, endpoint tags, valid PNG fixture, and separate summaries.
2. Run the checker and verify it fails because the performance files do not exist.
3. Add a base64-encoded 1080 × 1080 PNG and implement options, setup, read journey, write journey, checks, tags, and summary helper.
4. Keep all VUs, durations, thresholds, users, and pacing configurable through environment variables.

### Task 2: Add local and AWS entry scripts

**Files:**
- Create: `performance/k6/local.js`
- Create: `performance/k6/aws.js`

**Steps:**
1. Implement the local entry with default `http://api:8080/api`.
2. Implement the AWS entry with required `BASE_URL` and no safety-lock flag.
3. Export options, setup, read/write executors, and separate JSON summaries from both entries.
4. Run the static checker and `k6 inspect` for both scripts.

### Task 3: Add Compose runners and documentation

**Files:**
- Modify: `compose.yaml`
- Modify: `.gitignore`
- Modify: `README.md`
- Create: `performance/results/.gitkeep`

**Steps:**
1. Add `k6-local` and `k6-aws` services under the `performance` profile, pinned to `grafana/k6:2.3.0` with read-only scripts and writable results.
2. Ignore generated summaries while retaining the results directory.
3. Document local/AWS commands, defaults, environment overrides, thresholds, data growth, Grafana observation, and exit-code semantics in Chinese.
4. Validate Compose config and image version.

### Task 4: Execute both scripts against the local stack

**Files:**
- Modify only if runtime verification exposes defects.

**Steps:**
1. Run `k6 inspect` for local and AWS scripts.
2. Run local with one read VU and one write VU for a few seconds.
3. Run AWS entry against `http://api:8080/api` with the same short profile.
4. Verify both summaries exist, thresholds pass, the API remains healthy, and Grafana monitoring smoke still passes.
