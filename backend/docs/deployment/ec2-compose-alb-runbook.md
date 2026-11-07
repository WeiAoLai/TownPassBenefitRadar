# EC2 Docker Compose + ALB 部署 Runbook

使用 [`infra/cloudformation.yml`](../../../infra/cloudformation.yml) 建立或更新同一個 stack。範本包含具名 IAM role 與 instance profile，送出 change set 時需確認 `CAPABILITY_NAMED_IAM`。ALB 將前端、API、Swagger 與 Grafana 的流量送至 EC2 上的 Nginx。

- 更新既有 stack 時，沿用原有參數並檢查 change set。預期會移除舊 API rule、Grafana listener 和兩個對應 target groups。如果 change set 顯示 EC2 要被替換，先備份 `.env` 與 Docker volumes。原本的 root EBS 設定會在舊 EC2 終止時刪除磁碟。
- 新 stack 請選擇同一 VPC 內、跨至少兩個可用區且有 Internet Gateway 路由的 public subnets。EC2 使用第一個 subnet，GitHub Actions 透過 `EC2PublicIP` 輸出的 Elastic IP 連入。

## 1. EC2 前置設定

- 在 Ubuntu 安裝 Docker Engine、Buildx 與 Docker Compose v2（2.17 或更新）。以 `ubuntu` 使用者執行 `docker info` 與 `docker compose version` 確認權限和版本。
- `AWS_S3_BUCKET` 使用 stack 的 `S3BucketName`，`AWS_REGION` 使用 bucket 所在 Region。後端透過 IMDSv2 使用 EC2 instance role，AWS access key 相關欄位留空。
- 用具備寫入權限的 AWS 身分上傳背景及徽章至後端所用的 object keys，例如 `backgrounds/taipei-sunrise.png` 和 `badges/1/badge.png`。範本的 EC2 role 可讀取這兩個前綴並管理 `artworks/*`。

在 `/home/ubuntu/taipei-code-fest-app` 建立環境檔。可先把 repo 的 `.env.example` 傳到 EC2，或在第一次 workflow 上傳後使用已解開的範例檔。已有 `.env` 時直接編輯該檔。

```bash
cp .env.example .env
chmod 600 .env
```

至少修改 DB 密碼、實際的 `AWS_S3_BUCKET`、Grafana 密碼與公開 URL：

```dotenv
DB_PASSWORD=<strong-password>
DB_ROOT_PASSWORD=<different-strong-password>
AWS_REGION=<bucket-region>
AWS_S3_BUCKET=<actual-bucket-name>
GRAFANA_ADMIN_PASSWORD=<strong-password>
GRAFANA_ROOT_URL=http://<ALB-DNS>/grafana/
```

若 ALB 有 TLS listener，`GRAFANA_ROOT_URL` 改用 `https://`。網址必須保留 `/grafana/` 與結尾斜線。

## 2. 部署整組服務

在 GitHub Actions secrets 設定 `EC2_HOST`（stack 的 `EC2PublicIP`）與 `EC2_SSH_KEY`（對應 `KeyName` 的私鑰）。Push 到 `main` 或手動執行 **Deploy Full Stack to EC2**。Workflow 上傳 Git 追蹤的部署檔案，讀取 EC2 上的 `.env`，等待 Compose healthchecks，再測試 Nginx、API 和 Grafana。

在 repository 根目錄執行：

```bash
docker compose config --quiet
docker compose up --build --wait --wait-timeout 300
docker compose ps
```

`backend` 會等 MariaDB ready，再由 Flyway 自動建立／升級 schema。Prometheus 會等 backend healthcheck 通過，Grafana 會等 Prometheus ready 後啟動並自動載入 datasources 與 dashboards。

## 3. ALB target groups

只建立一個 HTTP target group，所有公開流量先進前端 Nginx：

| Target group | Traffic port | Health check port | Health check path |
|---|---:|---:|---|
| frontend | 80 | traffic port | `/healthz` |

EC2 security group 僅需允許 ALB security group 連入 TCP `80`。8080、8081、3000、3306、9090 僅綁定 EC2 loopback，供 SSH 登入後診斷使用。Loki 與 Alloy 僅供容器內網連線。

## 4. ALB listener rules

Listener default action 轉送 frontend target group：

| Path pattern | Forward to |
|---|---|
| default | frontend target group |

**既有 ALB 的 `/api/*`、`/grafana/*` 特殊規則須刪除或改指向 frontend target group**，否則仍會走舊連接埠。Nginx 自動把 `/api/` 代理到 backend、`/grafana/` 代理到 Grafana，並支援 Grafana Live WebSocket。Grafana sub-path 已由 Compose 固定啟用，只需設定公開 `GRAFANA_ROOT_URL`。

`/healthz` 代表入口 Nginx 可用。API 與監控服務的健康狀態仍由 Compose healthcheck 與 smoke test 驗證。

## 5. 部署後 smoke test

先在 EC2 驗證容器：

```bash
docker compose ps
curl --fail http://localhost:8081/actuator/health
curl --fail http://localhost:80/healthz
curl --fail http://localhost/grafana/api/health
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
  http://localhost/api/v1/me
echo "${trace_id}"
```

最後由 ALB 公開網址確認：

- `http://<ALB-DNS>/`：前端
- `http://<ALB-DNS>/api/v1/me`：加上 `X-Demo-User` 後回傳使用者資料
- `http://<ALB-DNS>/api/swagger-ui/index.html`：Swagger UI
- `http://<ALB-DNS>/grafana/`：Grafana

到 EC2 Target Groups 確認 `frontend-tg` 的 EC2 為 `healthy`，並從瀏覽器開啟一張由 S3 預簽網址提供的圖片。

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
