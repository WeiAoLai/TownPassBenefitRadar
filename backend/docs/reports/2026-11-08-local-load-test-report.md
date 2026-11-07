# 地端 k6 混合流量壓測報告

## 摘要

2026-11-08 於本機 Docker Compose 環境執行完整 4 分鐘混合流量壓測。測試由 5 個讀取 VU 與 1 個寫入 VU 逐步升至 50 個讀取 VU 與 10 個寫入 VU，總計送出 36,702 個 HTTP requests。

本次 k6 exit code 為 `0`，所有驗收門檻均通過：HTTP 錯誤率為 0%、checks 成功率為 100%、讀取 p95 為 26.33ms、寫入 p95 為 61.81ms。壓測期間應用程式保持健康，未觀察到 HikariCP 等待連線或 API 5xx。

本結果表示目前後端在本機環境、峰值 60 個並行 VU 的流量模型下沒有明顯效能瓶頸；它不是 AWS 正式環境的容量保證，仍需在 EC2、ALB 與真實 S3 環境重跑 AWS 腳本。

## 測試資訊

| 項目 | 內容 |
| --- | --- |
| 執行時間 | 2026-11-08 03:46–03:50（Asia/Taipei） |
| 被測版本 | `04080a4de6f7678d083a35521c648f839e770e93` |
| k6 image | `grafana/k6:2.3.0` |
| API target | Compose 內網 `http://api:8080/api` |
| 主機 | macOS 15.6、Apple Silicon (`arm64`) |
| Docker | Docker Engine 29.9.2、Docker Compose 5.6.1 |
| Docker 資源 | 10 CPUs、約 8 GB memory |
| Database | MariaDB 11.4 container |
| Object storage | LocalStack 3.8.1 S3 |

測試時 API、MariaDB、LocalStack、Prometheus、Grafana、Loki 與 Alloy 均運行在同一台本機的 Docker Desktop。網路延遲遠低於 AWS 實際環境，因此不能直接以本報告的 latency 推估正式環境 latency。

## 流量模型

讀取與寫入 scenario 同時使用 `ramping-vus` 執行：

| 階段 | 時間 | 讀取 VU | 寫入 VU | 合計 VU |
| --- | ---: | ---: | ---: | ---: |
| 暖機 | 30 秒 | 5 | 1 | 6 |
| 一般負載 | 1 分鐘 | 20 | 4 | 24 |
| 峰值負載 | 2 分鐘 | 50 | 10 | 60 |
| 降載 | 30 秒 | 0 | 0 | 0 |

讀取流程涵蓋：

- `GET /v1/me`
- `GET /v1/backgrounds`
- `GET /v1/policies/random`
- `GET /v1/artworks`
- `GET /v1/artworks/{id}`
- `GET /v1/leaderboard`

寫入流程使用 user-a 上傳 PNG 建立作品，再由 user-b 依序按讚、下載及取消讚：

- `POST /v1/artworks`
- `PUT /v1/artworks/{id}/like`
- `GET /v1/artworks/{id}/download`
- `DELETE /v1/artworks/{id}/like`

每個 iteration 結束後等待 1 秒。寫入流程會真的寫入 MariaDB 與 S3；因系統目前沒有刪除作品 API，本次產生的作品不會由 k6 自動清除。

## 實測結果

| 指標 | 驗收門檻 | 實測結果 | 判定 |
| --- | ---: | ---: | --- |
| HTTP request failure rate | `< 1%` | `0.00%` | 通過 |
| Checks success rate | `> 99%` | `100.00%` | 通過 |
| 讀取 scenario p95 | `< 500ms` | `26.33ms` | 通過 |
| 寫入 scenario p95 | `< 2,000ms` | `61.81ms` | 通過 |

### 整體統計

| 指標 | 結果 |
| --- | ---: |
| HTTP requests | 36,702 |
| 平均吞吐量 | 152.27 requests/sec |
| Iterations | 6,453 |
| Checks | 37,711 passed、0 failed |
| 整體平均 latency | 9.84ms |
| 整體 median latency | 4.17ms |
| 整體 p90 latency | 22.06ms |
| 整體 p95 latency | 42.46ms |
| 整體最大 latency | 310.74ms |

### Scenario latency

| Scenario | 平均 | Median | p90 | p95 | Max |
| --- | ---: | ---: | ---: | ---: | ---: |
| 讀取 | 8.34ms | 4.03ms | 17.59ms | 26.33ms | 264.45ms |
| 寫入 | 22.02ms | 15.06ms | 51.96ms | 61.81ms | 310.74ms |

## 服務與資源觀察

測試完成後執行 health check 與 monitoring smoke test，結果如下：

- Spring Boot liveness 與 readiness：`UP`
- Prometheus：`UP`
- Grafana：`healthy`
- Loki：`ready`
- Alloy：`ready`
- 壓測觀察區間內 application process CPU 峰值：約 20.24%
- HikariCP pending connections 峰值：0
- k6 HTTP failures：0；Prometheus 未回傳 API 5xx time series

以上 CPU 數字是應用程式 process metric，不等同於整台主機或 container 的 CPU 使用率。由於本次沒有固定獨占 Docker 資源，也沒有記錄磁碟 I/O、網路 I/O 與 MariaDB CPU，這些數字適合作為開發基準，不適合作為 EC2 sizing 的唯一依據。

## 結論與後續項目

本次測試在 60 個並行 VU、約 152 requests/sec 下通過全部門檻，且讀寫 p95 與門檻之間仍有明顯餘裕。地端基準可視為通過。

正式上線前仍應執行以下驗證：

1. 使用 `performance/k6/aws.js` 對 AWS ALB URL 重跑相同 4 分鐘測試。
2. 同步觀察 EC2 CPU／memory、MariaDB、ALB target response time、S3 latency 與 HikariCP。
3. 視 AWS 結果提高 VU，找出錯誤率上升、p95 超標或資源飽和的第一個區間。
4. 壓測前確認測試資料的保留或清除策略，避免持續累積作品與 S3 objects。

## 重現方式

先啟動完整地端服務，再執行：

```bash
docker compose up --build -d
docker compose --profile performance run --rm k6-local
```

k6 會以非零 exit code 表示任一 threshold 失敗。機器可讀的完整結果寫入：

```text
performance/results/local-summary.json
```

壓測時可同步開啟：

- Demo 總覽：`http://localhost:3000/d/good-morning-demo/demo`
- 維運排查：`http://localhost:3000/d/good-morning-backend/operations`

