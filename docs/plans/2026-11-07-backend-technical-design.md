# 長輩圖政策宣傳專案－後端技術規格

## 1. 文件資訊

- 日期：2026-11-07
- 狀態：已對齊，可作為後端實作依據
- 需求來源：[good-morning.md](../../good-morning.md)
- 範圍：Spring Boot 後端、MariaDB、Amazon S3，以及 Demo 部署

## 2. 技術基線

| 項目 | 決定 |
|---|---|
| 語言 | Java 21 LTS |
| Framework | Spring Boot 4.x |
| Build tool | Maven |
| 資料存取 | Spring Data JPA；必要時使用 JPQL／native SQL |
| 資料庫 | MariaDB 11.4 LTS |
| Migration | Flyway；Hibernate 不得自動修改 schema |
| Object storage | Amazon S3，使用 AWS SDK for Java 2.x |
| API | REST + OpenAPI 3；成功直接回傳資源，錯誤使用 `ProblemDetail` |
| 測試 | JUnit 5、Testcontainers MariaDB、mock S3 |
| 執行方式 | Docker；本機使用 Docker Compose |

## 3. 系統邊界與 MVP 原則

後端負責使用者識別、背景與政策查詢、作品儲存、作品清單、愛心、下載、排行榜、背景解鎖及徽章計算。圖片編輯由前端完成，後端只接受完成的 PNG。

MVP 採以下限制：

- 作品建立後不可修改、不可刪除，且一律公開。
- 隨機功能只選擇政策，不選擇背景。
- 停用背景或政策只禁止建立新作品，不影響既有作品瀏覽與下載。
- 不提供內容管理後台；背景與政策透過 Flyway seed data 匯入。
- 不提供草稿、留言、通知、檢舉、作者排行榜或多期間排行榜。

## 4. 架構

```text
Browser
  │ HTTPS
  ▼
Nginx on EC2
  ├── /      → Frontend
  └── /api   → Spring Boot container
                    ├── MariaDB container
                    └── Private Amazon S3 bucket
```

- 正式環境由同一個 Nginx 網域提供前後端服務。
- Spring Boot 與 MariaDB 僅透過 Docker network 溝通。
- MariaDB port 不對公網開放。
- S3 bucket 為 private，不使用 public-read object。
- 本機以 Docker Compose 啟動 Spring Boot 與 MariaDB。

## 5. Demo 身分驗證

### 5.1 請求格式

所有業務 API request 必須帶入：

```http
X-Demo-User: user-a
```

前端只傳 Demo 使用者代號，不傳 `owner_id`、SSO response 或個人資料。代號通常由前端使用者選擇後保存在 `localStorage`，並由 HTTP client interceptor 統一加入 request。

### 5.2 後端規則

- Demo 使用者 allowlist 由環境設定提供。
- 後端將代號映射為 `ssoSubject`、`account` 與 `displayName`。
- 首次請求時依 `sso_subject` 建立本地 `User`，後續請求取得既有使用者。
- 缺少 header 或代號不在 allowlist 時回傳 `401 Unauthorized`。
- 不接受 client 傳入的作品擁有者 ID。
- 此機制只在 Spring `demo` profile 啟用；正式 SSO 上線後以 authentication adapter 替換，不改動業務 service。
- 除最小必要欄位外，不保存 SSO 的身分證、Email、電話、生日或地址，亦不得寫入 log。

範例設定只放非機密 Demo 代號：

```yaml
app:
  auth:
    demo-users:
      user-a:
        sso-subject: demo-user-a
        account: user-a
        display-name: 小明
```

## 6. 資料模型

所有時間以 UTC 保存，Java 使用 `Instant`，API 回傳 ISO 8601，例如 `2026-11-07T08:30:00Z`。主鍵均使用 `BIGINT AUTO_INCREMENT`。

### 6.1 `users`

| 欄位 | 型別 | 規則 |
|---|---|---|
| `id` | BIGINT | PK, auto increment |
| `sso_subject` | VARCHAR(128) | NOT NULL, UNIQUE |
| `account` | VARCHAR(64) | NOT NULL, UNIQUE |
| `display_name` | VARCHAR(100) | NOT NULL |
| `created_at` | DATETIME(6) | NOT NULL, UTC |
| `updated_at` | DATETIME(6) | NOT NULL, UTC |

### 6.2 `backgrounds`

| 欄位 | 型別 | 規則 |
|---|---|---|
| `id` | BIGINT | PK, auto increment |
| `name` | VARCHAR(100) | NOT NULL |
| `image_object_key` | VARCHAR(512) | NOT NULL, UNIQUE |
| `unlock_threshold` | INT | NOT NULL, default 0, `>= 0` |
| `is_active` | BOOLEAN | NOT NULL |
| `created_at` | DATETIME(6) | NOT NULL, UTC |
| `updated_at` | DATETIME(6) | NOT NULL, UTC |

### 6.3 `policies`

| 欄位 | 型別 | 規則 |
|---|---|---|
| `id` | BIGINT | PK, auto increment |
| `category` | VARCHAR(100) | NOT NULL, indexed |
| `title` | VARCHAR(200) | NOT NULL |
| `slogan` | VARCHAR(500) | NOT NULL |
| `source_url` | VARCHAR(2048) | NOT NULL |
| `is_active` | BOOLEAN | NOT NULL |
| `start_date` | DATE | NOT NULL，包含當日 |
| `end_date` | DATE | NOT NULL，包含當日且不得早於開始日 |
| `created_at` | DATETIME(6) | NOT NULL, UTC |
| `updated_at` | DATETIME(6) | NOT NULL, UTC |

`source_url` 必須是 HTTPS，且 hostname 必須存在於環境設定的 allowlist。政策可選條件為 `is_active = true AND start_date <= today AND end_date >= today`；`today` 使用 `Asia/Taipei` 的日曆日期計算。到期或停用不影響既有作品。

### 6.4 `artworks`

| 欄位 | 型別 | 規則 |
|---|---|---|
| `id` | BIGINT | PK, auto increment |
| `owner_id` | BIGINT | NOT NULL, FK → users |
| `background_id` | BIGINT | NOT NULL, FK → backgrounds |
| `policy_id` | BIGINT | NOT NULL, FK → policies |
| `slogan_text` | VARCHAR(500) | NOT NULL，建立時快照 |
| `policy_source_url` | VARCHAR(2048) | NOT NULL，建立時快照 |
| `image_object_key` | VARCHAR(512) | NOT NULL, UNIQUE |
| `like_count` | BIGINT | NOT NULL, default 0, `>= 0` |
| `download_count` | BIGINT | NOT NULL, default 0, `>= 0` |
| `created_at` | DATETIME(6) | NOT NULL, UTC |

索引：

- `(owner_id, created_at DESC, id DESC)`：個人作品清單與作品數。
- `(created_at DESC, id DESC)`：公開作品清單。
- 排行榜查詢以 `GREATEST(like_count, download_count)` 排序；MVP 資料量可接受即時計算。

### 6.5 `artwork_likes`

| 欄位 | 型別 | 規則 |
|---|---|---|
| `id` | BIGINT | PK, auto increment |
| `user_id` | BIGINT | NOT NULL, FK → users |
| `artwork_id` | BIGINT | NOT NULL, FK → artworks |
| `created_at` | DATETIME(6) | NOT NULL, UTC |

建立唯一鍵 `(user_id, artwork_id)`，確保每位使用者對每件作品最多一筆愛心。

### 6.6 衍生值

| 值 | 計算方式 |
|---|---|
| 作品數 | `COUNT(artworks.id)` by owner |
| 背景解鎖 | `artwork_count >= unlock_threshold` |
| 排行榜分數 | `GREATEST(like_count, download_count)` |
| 徽章等級 | 已達門檻中的最高等級 |

徽章門檻固定為 `1、2、4、8、16、32、64、128、256、512`，名稱與 icon object key 放在程式設定，不建立 badge table。由於作品不可刪除，徽章與背景解鎖不會降級。

## 7. S3 規格

### 7.1 存取

- Bucket 為 private。
- DB 只保存 object key，不保存 URL 或圖片 binary。
- 前端顯示圖片時，由後端產生有效期 15 分鐘的 presigned GET URL。
- 每次查詢作品、背景或徽章時可產生新的 URL；前端不得長期保存過期 URL。
- 程式使用 AWS SDK 2.x default credentials provider chain。
- 程式碼與 Git 只保存 `AWS_REGION`、`AWS_S3_BUCKET` 等設定名稱，不保存 access key。
- EC2 上線後應優先使用 IAM Role；若 Demo 暫用環境變數，仍不得寫入 image、Git 或 application log。

### 7.2 Object key

```text
backgrounds/{backgroundId}/{filename}
badges/{level}/{filename}
artworks/{ownerId}/{randomUuid}.png
backups/{timestamp}.sql.gz.enc
```

### 7.3 作品圖片限制

- 只接受 PNG。
- 固定解析度 `1080 × 1080`。
- 單檔上限 10 MB。
- 後端同時驗證 Content-Type、實際檔案 signature、可解碼性與尺寸。
- 不符合規格回傳 `400 Bad Request`。

## 8. 建立作品流程

前端以 `multipart/form-data` 傳入：

- `image`：完成的 PNG。
- `backgroundId`。
- `policyId`。
- `sloganText`。

流程：

1. 驗證 Demo 使用者與 request。
2. 驗證背景及政策存在且啟用。
3. 計算使用者作品數並驗證背景已解鎖。
4. 驗證圖片格式、大小及解析度。
5. 從 policy 取得並驗證 HTTPS `source_url` allowlist。
6. 產生隨機 S3 object key，由後端上傳 PNG。
7. S3 上傳成功後，在 MariaDB transaction 新增 `Artwork`，並快照 slogan 與 source URL。
8. DB 寫入失敗時，best-effort 刪除剛上傳的 S3 object；清理失敗需記錄不含機密的 error log。
9. 只有 S3 與 DB 都成功才回傳 `201 Created`。

S3 無法參與 MariaDB transaction，因此使用補償刪除。S3 上傳失敗時不得建立作品紀錄。前端送出後停用儲存按鈕；MVP 不提供 `Idempotency-Key`，也不以圖片 hash 阻止相同作品。

## 9. 愛心規則

- 每位使用者對每件作品最多一個愛心，並可取消。
- 建議以 idempotent API：`PUT /artworks/{id}/like` 與 `DELETE /artworks/{id}/like`。
- 作者不可對自己的作品按愛心，回傳 `409 Conflict`。
- 新增／移除 `artwork_likes` 與更新 `artworks.like_count` 必須在同一個 DB transaction。
- 計數使用 atomic SQL update，不在 Java 內 read-modify-write。
- 重複 PUT 或 DELETE 維持目標狀態，不重複增減計數。

## 10. 下載與 QR Code

### 10.1 規格

- QR Code 內容使用 `Artwork.policy_source_url` 快照。
- 下載時由後端即時讀取原圖、產生 QR Code、合成並串流回傳，不保存衍生檔至 S3。
- QR Code 固定置於右下角，使用白色底板及安全留白。
- QR Code 寬度約為圖片短邊 20%，後端自動縮放。
- 輸出維持 `1080 × 1080` PNG。

### 10.2 計數

- 同一位使用者可重複下載，每次成功提供檔案都計數。
- 作者可下載自己的作品，但作者下載不增加計數。
- 非作者下載在圖片成功讀取與合成後，以 atomic SQL update 增加 `download_count`。
- 不建立 download history table。
- Nginx 對下載 endpoint 設定比一般 API 更嚴格的 rate limit，超限回傳 `429 Too Many Requests`。

## 11. 清單、背景、隨機與排行榜

### 11.1 公開與個人作品

- 公開作品預設依 `created_at DESC, id DESC`。
- 個人作品使用相同排序。
- Page-based pagination，預設每頁 20，最大 100。
- Response 提供 page、size、totalElements 與 totalPages。

### 11.2 背景

- 回傳所有 `is_active = true` 的背景。
- 每筆附上 `unlocked` 與 `unlockThreshold`。
- 前端顯示鎖定狀態；後端在建立作品時再次驗證。
- 嘗試使用未解鎖背景回傳 `403 Forbidden`。

### 11.3 隨機政策

- 只從 `is_active = true`、台北當地日期位於政策起訖日內，且 source URL 有效的政策中隨機選一筆。
- 不隨機背景。
- 連續兩次可能回傳同一筆政策。

### 11.4 排行榜

- 全期間排行榜，最多回傳前 100 件作品，不分頁。
- 分數：`GREATEST(like_count, download_count)`。
- 使用 competition ranking：例如 `1、2、2、4`。
- SQL 可使用 `RANK() OVER (ORDER BY GREATEST(...) DESC)`。
- 相同分數的顯示順序使用 `created_at DESC, id DESC`，但不影響名次。
- 每次查詢即時計算，不建立排程或 cache。
- 排行榜項目同時回傳作者目前最高徽章。

## 12. 建議 API

所有下列路徑以 `/api` 為 prefix。

| Method | Path | 用途 |
|---|---|---|
| GET | `/me` | 目前 Demo 使用者與徽章資訊 |
| GET | `/backgrounds` | 背景圖庫與解鎖狀態 |
| GET | `/policy-categories` | 政策類別 |
| GET | `/policies?category=` | 分類政策清單 |
| GET | `/policies/random` | 隨機啟用政策 |
| POST | `/artworks` | 上傳並建立作品 |
| GET | `/artworks` | 公開作品分頁 |
| GET | `/artworks/{id}` | 作品詳情 |
| GET | `/me/artworks` | 個人作品分頁 |
| PUT | `/artworks/{id}/like` | 設為已按愛心 |
| DELETE | `/artworks/{id}/like` | 取消愛心 |
| GET | `/artworks/{id}/download` | 下載附 QR Code 的 PNG |
| GET | `/leaderboard` | 全期間作品前 100 名 |

確切 DTO 欄位以 OpenAPI 為準。成功 response 直接回傳資源 JSON；錯誤使用 Spring `ProblemDetail` 及正確 HTTP status。

## 13. 錯誤處理

主要狀態碼：

- `400 Bad Request`：欄位、圖片格式、解析度或政策 URL 不合法。
- `401 Unauthorized`：缺少或無效的 `X-Demo-User`。
- `403 Forbidden`：使用未解鎖背景。
- `404 Not Found`：作品、背景或政策不存在。
- `409 Conflict`：作者對自己作品按愛心，或其他狀態衝突。
- `413 Payload Too Large`：圖片超過 10 MB；Nginx 與 Spring 限制需一致。
- `429 Too Many Requests`：超過 Nginx rate limit。
- `500 Internal Server Error`：未預期錯誤。
- `502 Bad Gateway` 或 `503 Service Unavailable`：必要的 S3／DB 暫時不可用，可依部署策略統一為 `503`。

`ProblemDetail` 應包含穩定的業務 error code 與 request trace ID，不包含 stack trace、憑證、SQL 或個資。

## 14. Seed data

- Flyway 建立 schema、constraint、index 與固定背景／政策資料。
- 背景與徽章圖片由 DevOps 先上傳 S3，migration 只保存 object key。
- Seed policy 必須通過 HTTPS、hostname allowlist 與起訖日期驗證。
- MVP 不提供管理 API。

## 15. 測試策略

### 單元測試

- 背景解鎖與作品數。
- 十級徽章邊界。
- 排行榜 score 與 competition ranking。
- 作者愛心／下載規則。
- 政策 URL allowlist。
- S3 object key 產生。
- QR Code 尺寸與位置計算。

### 整合測試

- Testcontainers MariaDB 11.4。
- Flyway 從空資料庫成功 migrate。
- JPA mapping、unique constraint 與 pagination。
- 愛心 transaction 與 concurrent atomic counter。
- 排行榜 native query。
- S3 service 使用 mock／fake implementation，涵蓋上傳失敗與 DB 失敗補償刪除。

### 部署驗證

- 使用測試物件執行真實 S3 upload、presigned GET、download 與 delete smoke test。
- 驗證下載 PNG 的 QR Code 可由一般手機掃描。
- 測試不得使用正式作品或將真實 access key 寫入 repository。

## 16. OpenAPI

- 使用支援 Spring Boot 4.x 的 springdoc 版本產生 OpenAPI 3。
- 開發環境提供 Swagger UI。
- 匯出的 `openapi.yaml` 納入版本控制。
- CI 驗證規格可成功產生，並可對破壞性 API 變更做 diff 檢查。

## 17. 部署與營運

### 17.1 EC2 Demo 架構

- 單台 EC2 執行 Docker Compose：Nginx、Spring Boot、MariaDB。
- Image 可推送至 ECR，再由 EC2 pull。
- Nginx 使用正式網域與 HTTPS，HTTP 自動導向 HTTPS。
- MariaDB data directory 使用獨立 EBS volume。
- Demo 不做 Multi-AZ、自動擴展或高可用。

### 17.2 Log 與健康檢查

- Spring Boot Actuator 提供 `/actuator/health`。
- 應用程式 log 寫 stdout，再傳至 CloudWatch Logs。
- CloudWatch Logs 保留 7 天。
- Log 不記錄圖片內容、憑證、完整 SSO payload 或個資。

### 17.3 備份與刪除

- Demo 期間每日執行 `mysqldump`。
- 備份壓縮、加密後存放於 private S3 backup prefix 或獨立 bucket。
- DB 密碼不得寫入 script 或 Git。
- Demo 結束後，經負責人確認後立即刪除使用者資料、MariaDB volume、DB 備份與使用者作品 object；刪除後不可復原。
- 背景、徽章及政策 seed assets 是否保留，由專案負責人另行決定。

## 18. 設定項目

至少需要下列環境設定；值不得提交至 Git：

```text
SPRING_PROFILES_ACTIVE
DB_HOST
DB_PORT
DB_NAME
DB_USERNAME
DB_PASSWORD
AWS_REGION
AWS_S3_BUCKET
AWS_ACCESS_KEY_ID          # 僅本機／臨時 Demo；EC2 優先使用 IAM Role
AWS_SECRET_ACCESS_KEY      # 僅本機／臨時 Demo；EC2 優先使用 IAM Role
POLICY_SOURCE_ALLOWED_HOSTS
PRESIGNED_URL_TTL
DEMO_USERS_CONFIG
```

Repository 應提供 `.env.example`，只包含 placeholder，不得包含可用憑證。

## 19. 實作前仍需由團隊提供

以下不改變架構，但需要在開發或部署前提供具體值：

- Demo 使用者代號、顯示名稱與數量。
- 政策來源允許網域清單。
- 背景圖、政策、徽章及其 S3 object key。
- 正式網域與 TLS 設定。
- Nginx 一般 API 與下載 API 的實際 rate-limit 數值。
- EC2 instance type、EBS 容量與 S3 bucket policy。
- Demo 結束時間及資料刪除負責人。

