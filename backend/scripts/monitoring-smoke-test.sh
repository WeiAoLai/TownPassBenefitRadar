#!/usr/bin/env bash
set -euo pipefail

prometheus_url="${PROMETHEUS_URL:-http://localhost:${PROMETHEUS_PORT:-9090}}"
grafana_url="${GRAFANA_URL:-http://localhost:${GRAFANA_PORT:-3000}}"
public_api_url="${PUBLIC_API_URL:-http://localhost:${NGINX_PORT:-8088}}"

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

wait_for "Prometheus" "$prometheus_url/-/ready"
wait_for "Grafana" "$grafana_url/api/health"

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

echo "monitoring smoke test passed: Prometheus target=UP Grafana=healthy public-metrics=blocked"
