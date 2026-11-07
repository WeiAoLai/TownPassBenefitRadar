# Grafana Alloy 與 Loki Logging Design

## 目標

在現有單一 EC2 Docker Compose 架構中加入集中式 log 查詢，讓 DevOps 可從既有 Grafana 依 Compose service、level 與 Spring Boot `traceId` 搜尋 log，並保留最近 7 天資料。

## 架構

Spring Boot 與其他 Compose services 繼續輸出到 stdout/stderr。Grafana Alloy 透過唯讀 Docker socket discovery 取得 `good-morning` Compose project 的 container logs，加入 `compose_project`、`compose_service`、`container` labels 後送至 Loki。Loki 使用單機 filesystem/TSDB 儲存於 named volume，啟用 compactor retention 並在 168 小時後刪除資料。Grafana 透過 Compose 內網的 `http://loki:3100` datasource 查詢，不公開 Loki port。

使用 `grafana/alloy:v1.21.0` 與 `grafana/loki:3.7.0` 固定版本。Alloy 自己的 positions/state 使用 named volume，避免 restart 後不必要地重送資料。Alloy 或 Loki 故障不會中斷業務 API；影響只限於該期間 log 的收集或查詢。

## 查詢與安全

Grafana Explore 預設可用 `{compose_project="good-morning", compose_service="api"}` 篩選 API logs，再使用 `|= "traceId=<id>"` 對應 `X-Request-ID`。目前 log 不含 request body、密碼、個資、圖片或 presigned URL。Docker socket 僅以 read-only volume 掛載，Alloy 與 Loki 均不對外開 port；對外仍只有 Grafana 經 ALB 存取。

## 驗證

Compose configuration 必須可解析；Loki `/ready`、Alloy `/-/ready` 與 Grafana provisioned Loki datasource 必須成功。Smoke test 送出帶固定 `X-Request-ID` 的 API request，輪詢 Loki query API，直到查到相同 trace ID。既有 80 個 Maven tests、API smoke test 與 Prometheus/Grafana checks 必須維持通過。
