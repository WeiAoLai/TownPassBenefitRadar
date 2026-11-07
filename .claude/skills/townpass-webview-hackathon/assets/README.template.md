# {{專案名稱}} / {{English project name}}

> {{一句話說明使用者問題與服務價值}}

![Demo preview]({{相對路徑或公開圖片 URL}})

## 1. 專案簡介 / Project Overview

### 問題與目標

{{說明目標使用者、情境、現有問題，以及本專案如何改善。避免只有功能清單。}}

### 核心功能

1. **{{功能一}}**：{{使用者得到的結果}}
2. **{{功能二}}**：{{使用者得到的結果}}
3. **{{功能三}}**：{{使用者得到的結果}}

### Demo

- Demo URL：{{URL}}
- Demo 影片：{{URL}}
- 測試限制：{{需要 TownPass WebView、權限或測試帳號時說明}}

## 2. 系統架構 / System Architecture

```text
TownPass Flutter App
└─ InAppWebView
   ├─ {{WebView frontend framework}}
   ├─ flutterObject message bridge
   └─ {{backend / public APIs / data store}}
```

| 類別 | 技術與版本 | 用途 |
|---|---|---|
| 前端 | {{框架與版本}} | {{用途}} |
| 狀態 | {{狀態管理或「無」}} | {{用途}} |
| 樣式 | {{CSS 方案}} | TownPass tokens 與元件樣式 |
| 後端 | {{技術或「無」}} | {{用途}} |
| 外部資料 | {{API 名稱}} | {{資料與更新頻率}} |

## 3. 安裝與執行 / Installation & Run

### 需求

- {{實際 runtime 與版本；使用官方 Vue starter 時為 Node.js 18+}}
- {{實際套件管理器與版本}}
- {{其他 runtime}}

### 本機執行

```sh
{{依 lockfile 與 package scripts 填寫可重現的安裝及啟動命令}}
```

本機網址：{{例如 `http://localhost:5173`}}

### 環境變數

| 名稱 | 必要 | 說明 | 範例 |
|---|---|---|---|
| `VITE_API_BASE_URL` | 是 | 公開 API base URL | `https://example.invalid` |

任何 `VITE_*` 值都會進入前端 bundle，不能放 API secret、權杖或個人資料。敏感值應由後端保存。

### 品質檢查

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

{{只保留 package.json 內真的存在且已驗證的命令。}}

## 4. TownPass WebView 整合

本專案透過 `window.flutterObject` 傳送 JSON 字串：

```json
{
  "name": "{{使用的方法名稱}}",
  "data": null
}
```

| 方法 | 使用情境 | Request | Reply / no reply |
|---|---|---|---|
| `{{method}}` | {{情境}} | {{資料形狀}} | {{回傳或無成功回覆}} |

{{說明瀏覽器開發模式、真機測試、權限拒絕與取消流程。不要放真實個資或位置資料。}}

### TownPass App 註冊與原生變更

- 服務設定：{{`MyServiceItemId`、category、destinationUrl、forceWebViewTitle，或「未修改 App」}}
- 圖示與產生程式碼：{{SVG 路徑與實際 build_runner 命令}}
- 自訂 Handler：{{名稱、用途、request／reply、iOS／Android 權限，或「無」}}
- App 內驗證：{{iOS／Android 裝置、TownPass commit／版本與結果}}

## 5. 功能與資料來源 / Features & Data

| 編號 | 功能 | 實作摘要 | 資料來源與授權 |
|---|---|---|---|
| 5.1 | {{功能}} | {{輸入、處理、輸出}} | {{官方資料集 URL、更新頻率、授權}} |

模擬、快取、衍生或生成資料：{{逐項標示；沒有就寫「無」}}

## 6. 設計與無障礙 / Design & Accessibility

- Figma UI kit：{{指定 TownPass Figma URL}}
- Typography 與 colors：{{列出專案 token 檔案路徑}}
- 觸控目標：至少 48 × 48
- 已測試：{{鍵盤、VoiceOver/TalkBack、200%、方向、reduced motion}}
- 已知限制：{{沒有就寫「無」；不要把未測試寫成通過}}

## 7. 裝置相容性與數位近用 / Device Compatibility

- 支援基準：{{經查證的最低 OS、TownPass 版本或 WebView 版本；不知道就明確標示待確認}}
- 實機測試：{{裝置型號、OS、WebView 版本與結果}}
- 受限環境測試：{{CPU／網路節流設定與結果；不得當成實機測試}}
- 降級策略：{{不支援特定 API、動畫、圖片格式或離線時，核心流程如何維持可用}}
- 效能紀錄：{{production bundle、主要資源大小與關鍵流程量測結果}}

本專案以降低數位落差為目標，避免把高階硬體、高速網路或最新 Web API 當成完成核心流程的必要條件。只列出實際驗證過的相容範圍。

## 8. 專案結構

```text
src/
├─ assets/
├─ components/
├─ composables/
├─ css/
├─ router/
├─ stores/
└─ views/
```

## 9. 部署、維運與安全

{{部署環境、region、build 產物、HTTPS、CORS/CSP、secret 管理、log 個資遮蔽、資料更新責任、監控、回復方式與接手流程。後端有容器時列出 Docker build/run 命令與 PORT。}}

## 10. 團隊與致謝

- {{姓名或 GitHub handle}}：{{分工}}

使用的開放資料、UI 資源、套件、模型、地圖／圖磚、插圖與第三方服務：

| 名稱與版本 | 類型／用途 | 來源 | 授權或使用條款 | 驗證日期 |
|---|---|---|---|---|
| {{名稱}} | {{用途}} | {{URL}} | {{SPDX 或條款 URL}} | {{YYYY-MM-DD}} |

## 11. AI 使用聲明

### 開發階段

{{列出使用的 AI 工具、用途、人工 review 與未輸入的敏感資料。若未使用，明確寫「未使用」。}}

### 執行階段

| 模型 | 版本 | 量化 | 推論框架 | 來源／授權 | 裝置需求 | 離線測試 |
|---|---|---|---|---|---|---|
| {{若產品含 AI 才保留}} | | | | | | |

{{說明使用者問題、裝置端或遠端處理位置、下載大小、冷啟動、失敗與非 AI fallback。依當屆規則揭露，不得把開發階段的雲端 AI 許可推定為產品執行階段許可。}}

## License

{{依目前競賽規則與實際程式碼確認授權名稱、版號、LICENSE 連結、上游 notices 與公開期限。不要從往屆 README 複製。}}
