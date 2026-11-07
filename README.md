# 早安政策圖 / Good Morning Policy Cards

TownPass WebView 微服務，讓長輩用台北景點或自己的照片製作問候圖，加入市政政策標語與 QR Code，再儲存分享給親友。

## Architecture

```text
TownPass App / Mobile Browser
          │
          ▼
GoodMorning（Vue 3 + Vite）
   ├─ flutterObject bridge
   └─ /api/v1
          │
          ▼
Nginx → Spring Boot API
          ├─ MariaDB
          └─ S3（本機使用 LocalStack）

Spring Boot Actuator → Prometheus → Grafana
```

| 目錄 | 用途 |
|---|---|
| `GoodMorning/` | WebView 前端、圖片編輯器、mock API 與前端測試 |
| `backend/` | Spring Boot API、資料庫 migration、S3、Swagger 與監控設定 |
| `docker-compose.yml` | 整合部署設定 |

API 契約位於 `backend/openapi.yaml`。前端透過 `VITE_API_MODE` 切換 mock 與 HTTP API。

## Installation

需求：Node.js 18 以上、npm、Docker Compose。

### 前端 mock 模式

不需啟動後端：

```sh
cd GoodMorning
npm ci
npm run dev
```

開啟 `http://localhost:5174`。

### 完整本機環境

先啟動 API、MariaDB、LocalStack、Prometheus 與 Grafana：

```sh
cd backend
cp .env.example .env
docker compose up --build -d
```

再啟動前端：

```sh
cd GoodMorning
npm ci
VITE_API_MODE=http \
VITE_API_BASE_URL=/api/v1 \
API_PROXY_TARGET=http://localhost:8088 \
npm run dev
```

服務入口：

- Frontend：`http://localhost:5174`
- API：`http://localhost:8088/api/v1`
- Swagger UI：`http://localhost:8088/api/swagger-ui.html`
- Prometheus：`http://localhost:9090`
- Grafana：`http://localhost:3000`

## Verification

```sh
cd GoodMorning
npm test
npm run build

cd ../backend
docker compose run --rm api mvn verify
```

前端與後端的環境變數、部署及測試細節，分別見 `GoodMorning/README.md` 與 `backend/README.md`。

## EC2 Deployment

單台 EC2 + ALB 的正式部署請依照 [`backend/docs/deployment/ec2-compose-alb-runbook.md`](backend/docs/deployment/ec2-compose-alb-runbook.md)。根目錄 `.env.example` 列出必填參數；完成 EC2 IAM role 與 `.env` 後，以 `docker compose up -d --build` 啟動整組服務。
