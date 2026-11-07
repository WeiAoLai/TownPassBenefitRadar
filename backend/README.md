# Good Morning Backend

台北政策長輩圖 Demo 後端，使用 Spring Boot 4、MariaDB、S3、Prometheus 與 Grafana。開發與測試全程在 container 內執行，本機不需要安裝 Java 或 Maven。

## 本機啟動

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
bash scripts/smoke-test.sh
bash scripts/monitoring-smoke-test.sh
```

預設入口：

- API v1 base URL：`http://localhost:8080/api/v1`
- Management health：`http://localhost:8081/actuator/health`
- Swagger UI：`http://localhost:8080/api/swagger-ui.html`
- Checked-in contract：`openapi.yaml`

Demo API 必須帶 `X-Demo-User: user-a`、`user-b` 或 `user-c`。Spring Boot 只接受 10 MB 圖片。AWS 正式入口的下載 rate limit 由 WAF rate-based rule 負責，本機 Compose 不模擬 WAF。

## 驗證

```bash
docker compose run --rm api mvn verify
ruby scripts/check-openapi.rb
bash scripts/check-db-schema.sh
bash scripts/smoke-test.sh
```

完整測試包含 Flyway、MariaDB repository、併發按讚、S3、OpenAPI 契約、QR Code 解碼與 controller/service 測試。

## Prometheus 與 Grafana

本機 `docker compose up --build -d` 會一併啟動 Prometheus 與 Grafana：

- Prometheus：`http://localhost:9090`
- Grafana：`http://localhost:3000`
- 預載 dashboard：`Good Morning / Good Morning Backend`
- Grafana 本機預設帳號：`admin` / `change-me`，請在 `.env` 覆寫 `GRAFANA_ADMIN_PASSWORD`。

Prometheus 每 15 秒透過 Compose 內網抓取 `api:8081/actuator/prometheus`。Actuator 使用獨立 management port `8081`，業務 API port `8080` 不提供 `/api/actuator/*`，避免 JVM 與 DB pool metrics 進入公開 API。正式環境可改由既有的 Prometheus 或 Amazon Managed Service for Prometheus 抓取，但 scrape endpoint 必須保持在 private network。

已 provision 的 dashboard 包含 request rate、5xx ratio、HTTP p50/p95 latency、JVM heap、HikariCP connections 與 process CPU。Prometheus 與 Grafana 資料分別保存在 `prometheus-data`、`grafana-data` volumes。

## Logging 與問題追蹤

- 每個 API response 都會回傳 `X-Request-ID`；若入口未提供，後端會產生 UUID。
- Spring Boot access log 包含 method、path、status、duration、user ID 與相同的 MDC `traceId`。
- 未預期例外與 S3 dependency failure 會記錄 stack trace；作品建立、按讚與下載會記錄不含個資的業務事件。
- 不記錄 request body、密碼、身分資料、圖片內容或 presigned URL。

查詢單次 request：

```bash
docker compose logs api | grep '<X-Request-ID>'
```

## 環境變數

本機 Compose 預設使用 LocalStack S3，`.env.example` 的 `test` credential 只適用於 LocalStack。真實 AWS 環境應由 ECS task role、EC2 instance profile 或 IRSA 提供 IAM credential，不要把 access key 寫進 image、Git 或部署設定檔。

正式環境至少提供：

```text
SPRING_PROFILES_ACTIVE=demo
SPRING_DATASOURCE_URL=jdbc:mariadb://<host>:3306/good_morning?sessionVariables=time_zone='+00:00'
SPRING_DATASOURCE_USERNAME=<secret reference>
SPRING_DATASOURCE_PASSWORD=<secret reference>
SPRING_FLYWAY_ENABLED=true
SPRING_FLYWAY_URL=jdbc:mariadb://<host>:3306/good_morning?sessionVariables=time_zone='+00:00'
SPRING_FLYWAY_USER=<migration secret reference>
SPRING_FLYWAY_PASSWORD=<migration secret reference>
API_BIND_ADDRESS=0.0.0.0
API_PORT=8080
MANAGEMENT_BIND_ADDRESS=0.0.0.0
MANAGEMENT_PORT=8081
GRAFANA_BIND_ADDRESS=0.0.0.0
GRAFANA_PORT=3000
GRAFANA_DOMAIN=grafana.example.com
GRAFANA_ROOT_URL=https://grafana.example.com
GRAFANA_COOKIE_SECURE=true
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=<secret reference>
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET=<asset bucket>
PRESIGNED_URL_TTL=PT15M
```

Flyway 會在應用程式啟動時執行 `classpath:db/migration`，成功後才完成 Spring Boot 啟動。若未提供 `SPRING_FLYWAY_URL/USER/PASSWORD`，會沿用 `SPRING_DATASOURCE_*`；demo 可使用同一組帳號。正式環境建議提供獨立 migration 帳號，該帳號需要 schema DDL/DML 權限，runtime datasource 帳號則只保留應用程式需要的 CRUD 權限。部署時不要把密碼寫入 image 或 Git，請使用平台的 secret reference。

Flyway 預設啟用 migration validation，且禁止 `clean`。若 migration 失敗，應用程式會直接啟動失敗，不會在不完整 schema 上提供服務；可從 log 搜尋 `Flyway` 或 `flyway_schema_history` 排查。

部署到真實 AWS 時不要設定 `S3_ENDPOINT` 或 `S3_PUBLIC_ENDPOINT`；這兩個值只供 LocalStack 使用。Bucket 需預先包含背景與徽章 object key，作品則由 API 寫入 `artworks/{userId}/{uuid}.png`。

## EC2 與 ALB

正式環境由 ALB 直接連到同一台 EC2，不再經過 Nginx：

- API target group：HTTP `8080`。
- API health check：port `8081`、path `/actuator/health`。
- Grafana target group：HTTP `3000`、health check `/api/health`，使用獨立 host rule，例如 `grafana.example.com`。
- EC2 security group 的 `8080`、`8081`、`3000` 只接受 ALB security group；Prometheus `9090` 不開放。
- ALB 負責 HTTPS termination；container 內部維持 HTTP。
- 下載 API 的 rate limit 由 AWS WAF rate-based rule 實作，超限 custom response 使用 HTTP 429。

本機預設把 API、management、Prometheus 與 Grafana 綁在 `127.0.0.1`。AWS `.env` 必須將 API、management 與 Grafana bind address 改為 `0.0.0.0`，ALB 才能連入；MariaDB 與 Prometheus 不應建立 public listener。

## 資料與圖片流程

- 前端上傳完成的 `1080 x 1080` PNG。
- 後端先寫入 S3，成功後才登記 MariaDB；DB transaction 失敗會清理 S3 object。
- 一般顯示使用 15 分鐘 presigned URL。
- 下載時即時讀取原圖、在右下角合成政策來源 QR Code，不另存衍生圖片。
- 非作者成功下載才會原子增加下載數；作者下載不計數。

資料庫 schema 與種子資料由 `src/main/resources/db/migration` 下的 Flyway migrations 管理。
