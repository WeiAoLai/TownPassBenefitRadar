# Grafana 中文 Dashboard 設計

## 目標

提供兩個分工清楚的 Grafana Dashboard：`Good Morning｜Demo 總覽` 用於展示系統健康與業務活動，`Good Morning｜維運排查` 用於定位 API、JVM、資料庫與依賴服務異常。所有 panel 使用中文標題與說明，讓接手者能理解數字意義、正常範圍及異常時的排查方向。

## Dashboard

Demo 總覽預設顯示最近 15 分鐘，包含 API 在線狀態、request rate、非 5xx 成功率、p95 latency、作品建立數、有效下載數、按讚與取消讚數、CPU、Heap，以及 Loki 即時業務活動。版面以 stat 與簡單趨勢為主，方便投影展示。

維運排查預設顯示最近 1 小時，分為 API、JVM／資料庫、Log 三區。API 區提供 endpoint request rate、5xx ratio、p50／p95／p99 與 HTTP status 分布；資源區提供 Heap、GC、Thread、CPU 與 HikariCP active／idle／pending／max；Log 區顯示 ERROR／WARN 與 dependency failure。初始紅色門檻為 5xx 大於 1%、p95 大於 1 秒、Heap 或 CPU 大於 80%、DB pending 大於 0，之後以 k6 基準結果調整。

## 業務 Metrics

新增集中式 `BusinessMetrics` 元件，透過 Micrometer 記錄低基數 counter：

- `good_morning.artworks.creation`：作品交易成功提交；避開 Prometheus 保留的 `_created` suffix。
- `good_morning.artworks.downloaded`：非作者成功下載且下載計數更新。
- `good_morning.artwork.likes{action="like"}`：按讚狀態真正新增。
- `good_morning.artwork.likes{action="unlike"}`：按讚狀態真正移除。

counter 不包含 user ID、artwork ID 等高基數 label。若目前存在 Spring transaction synchronization，counter 延後到 transaction commit 後累加；rollback 不累加。近期活動仍由 Loki 的結構化 application log 提供。

## 驗證

單元測試驗證 counter 名稱、tag、成功／冪等操作及 commit／rollback 語意。Dashboard 靜態檢查驗證 JSON、唯一 UID、資料來源與中文 description；monitoring smoke test 驗證兩個 provisioned dashboards、Prometheus、Loki 與 Alloy 均可使用。
