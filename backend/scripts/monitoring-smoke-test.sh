#!/usr/bin/env bash
set -euo pipefail

prometheus_url="${PROMETHEUS_URL:-http://localhost:${PROMETHEUS_PORT:-9090}}"
grafana_url="${GRAFANA_URL:-http://localhost:${GRAFANA_PORT:-3000}}"
public_api_url="${PUBLIC_API_URL:-http://localhost:${API_PORT:-8080}}"
grafana_user="${GRAFANA_ADMIN_USER:-admin}"
grafana_password="${GRAFANA_ADMIN_PASSWORD:-change-me}"

wait_for() {
  local name="$1"
  local url="$2"

  for _ in $(seq 1 30); do
    if curl --fail --silent "$url" >/dev/null; then
      return 0
    fi
    sleep 1
  done

  echo "$name did not become ready: $url" >&2
  return 1
}

wait_for_internal() {
  local name="$1"
  local url="$2"

  for _ in $(seq 1 30); do
    if docker compose exec -T grafana wget -qO- "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "$name did not become ready inside the Compose network: $url" >&2
  return 1
}

wait_for "Prometheus" "$prometheus_url/-/ready"
wait_for "Grafana" "$grafana_url/api/health"
wait_for_internal "Loki" "http://loki:3100/ready"
wait_for_internal "Alloy" "http://alloy:12345/-/ready"

loki_datasource=$(curl --fail --silent --show-error \
  --user "$grafana_user:$grafana_password" \
  "$grafana_url/api/datasources/uid/loki")
if ! grep -q '"uid":"loki"' <<<"$loki_datasource"; then
  echo "Grafana Loki datasource is not provisioned" >&2
  echo "$loki_datasource" >&2
  exit 1
fi

loki_health=$(curl --fail --silent --show-error \
  --user "$grafana_user:$grafana_password" \
  "$grafana_url/api/datasources/uid/loki/health")
if ! grep -q '"status":"OK"' <<<"$loki_health"; then
  echo "Grafana cannot connect to Loki" >&2
  echo "$loki_health" >&2
  exit 1
fi

targets=""
for _ in $(seq 1 30); do
  targets=$(curl --fail --silent --show-error \
    "$prometheus_url/api/v1/query?query=up%7Bjob%3D%22good-morning%22%7D")
  if grep -q '"value":\[[^]]*,"1"\]' <<<"$targets"; then
    break
  fi
  sleep 1
done

if ! grep -q '"value":\[[^]]*,"1"\]' <<<"$targets"; then
  echo "Prometheus is not scraping the good-morning target" >&2
  echo "$targets" >&2
  exit 1
fi

metrics_status=$(curl --silent --output /dev/null --write-out '%{http_code}' "$public_api_url/api/actuator/prometheus")
if [[ "$metrics_status" != "404" ]]; then
  echo "public metrics endpoint must return 404, got $metrics_status" >&2
  exit 1
fi

trace_id="monitoring-smoke-$(date +%s)-$$"
curl --fail --silent --show-error \
  --header "X-Demo-User: user-a" \
  --header "X-Request-ID: $trace_id" \
  "$public_api_url/api/v1/me" >/dev/null

loki_result=""
for _ in $(seq 1 30); do
  loki_result=$(curl --fail --silent --show-error \
    --user "$grafana_user:$grafana_password" \
    --get \
    --data-urlencode 'query={compose_project="good-morning", compose_service="api"}' \
    --data-urlencode 'since=5m' \
    "$grafana_url/api/datasources/proxy/uid/loki/loki/api/v1/query_range")
  if grep -Fq "$trace_id" <<<"$loki_result"; then
    break
  fi
  sleep 1
done

if ! grep -Fq "$trace_id" <<<"$loki_result"; then
  echo "Loki did not receive the API log for trace ID: $trace_id" >&2
  echo "$loki_result" >&2
  exit 1
fi

echo "monitoring smoke test passed: Prometheus=UP Grafana=healthy Loki=ready Alloy=ready traceId=$trace_id"
