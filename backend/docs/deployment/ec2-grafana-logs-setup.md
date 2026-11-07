# EC2 Docker Compose：Grafana Logs 設定指南

本文件適用於單台 EC2 執行 frontend、Spring Boot、MariaDB、Prometheus 與 Grafana 的部署方式。後端 Compose service 名稱假設為 `backend`，Compose 檔案位於 repository 根目錄，因此 monitoring 設定檔路徑使用 `./backend/monitoring/...`。

## 先確認 Dashboard 為何沒有 Metrics

Dashboard 已出現但所有 Prometheus panels 顯示 `No data`，通常表示 Grafana provisioning 已成功，但 Prometheus 尚未抓到 Spring Boot Actuator。

先從 Prometheus container 驗證 management endpoint：

```bash
docker compose exec -T prometheus \
  wget -qO- http://backend:8081/actuator/prometheus | head
```

接著檢查 Prometheus target：

```bash
curl --silent --get \
  --data-urlencode 'query=up{job="good-morning"}' \
  http://localhost:9090/api/v1/query
```

結果必須包含值 `1`。如果沒有資料或值為 `0`，將 `backend/monitoring/prometheus/prometheus.yml` 的 target 設為：

```yaml
scrape_configs:
  - job_name: good-morning
    metrics_path: /actuator/prometheus
    static_configs:
      - targets:
          - backend:8081
```

重新建立 Prometheus：

```bash
docker compose up -d --force-recreate prometheus
```

Prometheus 每 15 秒抓取一次。確認 target 為 `1` 後操作一次前端，或呼叫：

```bash
curl --fail \
  --header 'X-Demo-User: user-a' \
  http://localhost:8080/api/v1/me
```

等待約 15–30 秒再查看 Dashboard。剛啟動且沒有 API 流量時，request rate 與 latency panels 暫時沒有資料是正常現象。

## Logging 架構

```text
Spring Boot stdout/stderr
          ↓
   Grafana Alloy
          ↓
       Loki
          ↓
Grafana Loki datasource
          ↓
 Explore / Dashboard logs panels
```

Spring Boot 不需要將 log 寫入檔案。Alloy 透過唯讀 Docker socket 讀取 container stdout/stderr，再送到 Compose 私有網路內的 Loki。

## 1. 固定 Compose Project 名稱

`backend/monitoring/alloy/config.alloy` 只收集 Compose project `good-morning` 的 containers，因此 production Compose 最上方必須設定：

```yaml
name: good-morning

services:
  # ...
```

舊的 `version: '3.8'` 可以移除；新版 Docker Compose 已不需要 `version`。如果保留也不影響本設定，`name` 才是 Alloy discovery 使用的 project label。

## 2. 加入 Loki 與 Alloy Services

把以下 services 加進 repository 根目錄的 production Compose：

```yaml
services:
  loki:
    image: grafana/loki:3.7.0
    container_name: loki
    command:
      - -config.file=/etc/loki/config.yml
      - -config.expand-env=true
    environment:
      LOKI_RETENTION: ${LOKI_RETENTION:-168h}
    volumes:
      - ./backend/monitoring/loki/config.yml:/etc/loki/config.yml:ro
      - loki-data:/loki
    restart: always

  alloy:
    image: grafana/alloy:v1.21.0
    container_name: alloy
    command:
      - run
      - --server.http.listen-addr=0.0.0.0:12345
      - --storage.path=/var/lib/alloy/data
      - /etc/alloy/config.alloy
    volumes:
      - ./backend/monitoring/alloy/config.alloy:/etc/alloy/config.alloy:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - alloy-data:/var/lib/alloy/data
    depends_on:
      - loki
    restart: always
```

不要替 Loki `3100` 或 Alloy `12345` 設定 host port，也不要加入 ALB target group。Grafana 會透過 Compose 私有網路連線。

## 3. Provision Grafana Loki Datasource

Grafana 必須掛載 datasources、dashboard provider 與 dashboard JSON：

```yaml
services:
  grafana:
    # 原本 image、environment、port 保留
    volumes:
      - grafana-data:/var/lib/grafana
      - ./backend/monitoring/grafana/provisioning/datasources:/etc/grafana/provisioning/datasources:ro
      - ./backend/monitoring/grafana/provisioning/dashboards:/etc/grafana/provisioning/dashboards:ro
      - ./backend/monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
    depends_on:
      - prometheus
      - loki
      - alloy
    restart: always
```

Datasource 設定已存在於 `backend/monitoring/grafana/provisioning/datasources/loki.yml`，內部 URL 是：

```text
http://loki:3100
```

在 Compose 最下方加入持久化 volumes：

```yaml
volumes:
  # 原本 volumes 保留
  loki-data:
  alloy-data:
```

一般 `docker compose down` 不會刪除 log。不要執行 `docker compose down -v`，否則 Loki、Grafana、Prometheus 與 MariaDB named volumes 都會被刪除。

## 4. 使用 Production Service Label

目前 production 後端 service 名稱是 `backend`，因此 Grafana Explore 的 LogQL 使用：

```logql
{compose_project="good-morning", compose_service="backend"}
```

常用查詢：

```logql
{compose_project="good-morning", compose_service="backend"} |= "level=ERROR"
{compose_project="good-morning", compose_service="backend"} |= "traceId=<X-Request-ID>"
{compose_project="good-morning", compose_service="backend"} |~ "artwork_(created|like_set|downloaded)"
```

Checked-in Dashboard 原本使用本機 service 名稱 `api`。正式環境若保留 `backend`，請將三個 logs panels 的 selector 從：

```logql
compose_service="api"
```

改為同時支援兩個環境：

```logql
compose_service=~"api|backend"
```

涉及的檔案：

- `backend/monitoring/grafana/dashboards/good-morning-demo.json`
- `backend/monitoring/grafana/dashboards/good-morning-backend.json`

修改 JSON 後重新建立 Grafana，provisioner 會重新載入 Dashboard。

## 5. 啟動與基礎驗證

先驗證 Compose，再啟動 logging pipeline：

```bash
docker compose config >/dev/null
docker compose up -d loki alloy grafana
docker compose ps
```

確認 Loki 與 Alloy 在 Compose 私有網路內 ready：

```bash
docker compose exec -T grafana wget -qO- http://loki:3100/ready
docker compose exec -T grafana wget -qO- http://alloy:12345/-/ready
```

兩個指令都應回傳 ready／healthy 內容。接著檢查啟動 log：

```bash
docker compose logs --tail=100 loki
docker compose logs --tail=100 alloy
docker compose logs --tail=100 grafana | grep -Ei 'loki|datasource|dashboard|provision|error'
```

若 Alloy 沒有發現任何 target，優先確認：

```bash
docker inspect spring-backend \
  --format '{{ index .Config.Labels "com.docker.compose.project" }} {{ index .Config.Labels "com.docker.compose.service" }}'
```

production 預期輸出：

```text
good-morning backend
```

## 6. 端到端 Trace ID 驗證

送出一個可辨認的 request：

```bash
trace_id="ec2-log-smoke-$(date +%s)"

curl --fail \
  --header 'X-Demo-User: user-a' \
  --header "X-Request-ID: ${trace_id}" \
  http://localhost:8080/api/v1/me

echo "${trace_id}"
```

開啟 Grafana：

```text
http://<ALB-DNS>/grafana/
```

進入 **Explore**，datasource 選擇 **Loki**，查詢：

```logql
{compose_project="good-morning", compose_service="backend"} |= "ec2-log-smoke-"
```

應在數秒內看到剛才的 request log，並包含相同 `traceId`。確認 Explore 查得到後，再查看 Dashboard 的「即時業務活動」、「WARN / ERROR」與「Dependency failure」panels。

## 常見問題

### Grafana 找不到 Loki datasource

確認 datasource 檔案已掛進 container：

```bash
docker compose exec -T grafana \
  cat /etc/grafana/provisioning/datasources/loki.yml
```

### Loki datasource 存在，但顯示連線失敗

```bash
docker compose exec -T grafana wget -qO- http://loki:3100/ready
```

失敗時檢查 `loki` 是否與 `grafana` 在同一個 Compose network，以及 Loki container 是否反覆重啟。

### Loki ready，但完全沒有 logs

依序檢查：

1. Compose project label 是否為 `good-morning`。
2. Alloy 是否掛載 `/var/run/docker.sock:ro`。
3. Alloy log 是否有 discovery 或 push error。
4. LogQL 使用的是 production service 名稱 `backend`，不是本機的 `api`。
5. Spring Boot 是否把 log 輸出到 stdout，可先用 `docker compose logs backend` 確認。

### Dashboard 有 Metrics，但 Logs panel 沒資料

這代表 Prometheus 正常，問題只在 Loki 管線。先用 Grafana Explore 執行最寬鬆的查詢：

```logql
{compose_project="good-morning"}
```

若有其他 service、但沒有 backend，再檢查 Alloy discovery label 與 `docker compose logs backend`。若 Explore 有 backend logs、但 Dashboard 沒有，則是 Dashboard 的 `compose_service` selector 尚未從 `api` 調整為 `api|backend`。

