# EC2 Docker Compose + ALB 部署 Runbook

目標是讓單台 EC2 在準備好 IAM role 與 `.env` 後，只需執行根目錄的 Docker Compose，再設定 ALB rules，即可使用前端、API、Swagger、Grafana metrics 與 Loki logs。

## 1. EC2 前置設定

- 安裝 Docker Engine 與 Docker Compose v2。
- EC2 instance role 必須能存取指定 S3 bucket；至少允許 bucket 的 `s3:ListBucket`，以及 assets objects 的 `s3:GetObject`、`s3:PutObject`、`s3:DeleteObject`。
- S3 內須已有約定的 backgrounds 與 badges object keys。
- 不要在 EC2 放長效 `AWS_ACCESS_KEY_ID`／`AWS_SECRET_ACCESS_KEY`；後端會使用 instance role。

建立環境檔：

```bash
cp .env.example .env
chmod 600 .env
```

至少修改 DB 密碼、實際的 `AWS_S3_BUCKET`、Grafana 密碼與公開 URL：

```dotenv
DB_PASSWORD=<strong-password>
DB_ROOT_PASSWORD=<different-strong-password>
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET=<actual-bucket-name>
GRAFANA_ADMIN_PASSWORD=<strong-password>
GRAFANA_ROOT_URL=http://<ALB-DNS>/grafana/
GRAFANA_SERVE_FROM_SUB_PATH=true
```

若 ALB 有 TLS listener，`GRAFANA_ROOT_URL` 改用 `https://`。網址必須保留 `/grafana/` 與結尾斜線。

## 2. 一次啟動整組服務

在 repository 根目錄執行：

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

`backend` 會等 MariaDB ready，再由 Flyway 自動建立／升級 schema。Prometheus 會等 backend healthcheck 通過，Grafana 會等 Prometheus ready 後啟動並自動載入 datasources 與 dashboards。

## 3. ALB target groups

同一台 EC2 建立三個 HTTP target groups：

| Target group | Traffic port | Health check port | Health check path |
|---|---:|---:|---|
| frontend | 80 | traffic port | `/healthz` |
| backend | 8080 | 8081 | `/actuator/health` |
| grafana | 3000 | traffic port | `/grafana/api/health` |

EC2 security group 僅需允許 ALB security group 連入 TCP `80`、`8080`、`8081`、`3000`。MariaDB、Prometheus、Loki 與 Alloy 不需要加入 ALB target group，也不應開放至 Internet。

## 4. ALB listener rules

按優先順序設定：

| Path pattern | Forward to |
|---|---|
| `/grafana`, `/grafana/*` | grafana target group |
| `/api/*` | backend target group |
| default | frontend target group |

ALB 會保留原始 path，Grafana 因此必須使用上面的 sub-path 兩個環境變數。

## 5. 部署後 smoke test

先在 EC2 驗證容器：

```bash
docker compose ps
curl --fail http://localhost:8081/actuator/health
curl --fail http://localhost:80/healthz
curl --fail http://localhost:3000/api/health
curl --silent --get \
  --data-urlencode 'query=up{job="good-morning"}' \
  http://localhost:9090/api/v1/query
```

Prometheus 查詢結果需為 `1`。再製造一筆 API traffic 與可辨識的 log：

```bash
trace_id="ec2-smoke-$(date +%s)"
curl --fail \
  --header 'X-Demo-User: user-a' \
  --header "X-Request-ID: ${trace_id}" \
  http://localhost:8080/api/v1/me
echo "${trace_id}"
```

最後由 ALB 公開網址確認：

- `http://<ALB-DNS>/`：前端
- `http://<ALB-DNS>/api/v1/me`：加上 `X-Demo-User` 後回傳使用者資料
- `http://<ALB-DNS>/api/swagger-ui/index.html`：Swagger UI
- `http://<ALB-DNS>/grafana/`：Grafana

Grafana 的 **Good Morning** folder 應自動出現 dashboards。Metrics 最多等一個 15 秒 scrape interval；Logs 可在 Explore 選 Loki 後查詢：

```logql
{compose_project="good-morning", compose_service=~"api|backend"} |= "ec2-smoke-"
```

## 6. 快速故障定位

```bash
docker compose ps
docker compose logs --tail=200 backend
docker compose logs --tail=200 prometheus
docker compose logs --tail=200 grafana
docker compose logs --tail=200 loki alloy
docker compose exec -T prometheus wget -qO- http://api:8081/actuator/prometheus | head
docker compose exec -T grafana wget -qO- http://loki:3100/ready
docker compose exec -T grafana wget -qO- http://alloy:12345/-/ready
```

一般更新使用 `docker compose up -d --build` 即可。不要執行 `docker compose down -v`，否則 MariaDB、Grafana、Prometheus 與 Loki 的資料 volumes 會被刪除。
