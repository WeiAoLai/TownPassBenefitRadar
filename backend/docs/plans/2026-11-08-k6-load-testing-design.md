# k6 混合流量壓測設計

## 目標

提供本機 Docker Compose 與 AWS ALB 兩支獨立 k6 入口，使用相同的混合 workload 與效能門檻。測試以階梯式 VU 找出服務開始退化的區間，並讓既有 Prometheus／Grafana Dashboard 同步呈現 API latency、錯誤率、CPU、Heap 與 DB pool 壓力。

## 入口與執行環境

- `performance/k6/local.js` 預設使用 Compose 內網 `http://api:8080/api`。
- `performance/k6/aws.js` 從必要的 `BASE_URL` 接收 ALB API base URL，不增加額外解鎖旗標。
- `performance/k6/workload.js` 共用 API 流程、options、checks 與 thresholds。
- Compose 以 `performance` profile 提供 `k6-local` 與 `k6-aws`，固定使用 `grafana/k6:2.3.0`。

## 流量模型

兩個 ramping-vus scenario 同時執行。查詢 scenario 預設依序為 5、20、50、0 VUs；寫入 scenario 為 1、4、10、0 VUs，約維持 80/20 的使用者比例。預設階段時間為 30 秒、1 分鐘、2 分鐘、30 秒，VU 與時間皆可用環境變數覆寫。

查詢流程包含目前使用者、背景、隨機政策、作品列表、作品詳情與排行榜。寫入流程使用 user-a 上傳固定 1080 × 1080 PNG 建立作品，再由 user-b 按讚、下載與取消讚。每次成功寫入都會保留在 MariaDB 與 S3，因目前沒有刪除作品 API。

## 驗收門檻

- `http_req_failed` 小於 1%。
- `checks` 成功率高於 99%。
- 查詢 scenario p95 小於 500ms。
- 寫入 scenario p95 小於 2 秒。

每個 request 加上 endpoint 與 workflow tag，方便 k6 summary 定位問題。兩支入口分別輸出 JSON summary 到 `performance/results`；CI 或人工執行可直接依 k6 exit code 判定是否達標。

## 驗證

靜態檢查驗證兩支入口、scenario 比例、thresholds、必要 endpoint 與 fixture。`k6 inspect` 驗證 script 可載入；短時間 smoke profile 分別以 local 與 AWS 入口對本機 API 執行，確認 setup、multipart upload、按讚、下載、取消讚與 summary 輸出。
