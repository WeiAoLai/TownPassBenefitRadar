# 早安政策圖 / Good Morning Policy Cards

> 讓長輩用熟悉的「早安圖」把台北市政好消息傳給親友：選台北景點背景、挑一則政策標語，做好就能下載附政策 QR Code 的長輩圖。

本資料夾是 TownPass（台北通）WebView 微服務的**前端**。需求以 `good-morning.md`（長輩圖政策宣傳專案需求文件）為準，API 以 `openapi.yaml` v0.1.0 為準。

## 1. 專案簡介

### 核心功能

| 需求 | 畫面 | 實作摘要 |
|---|---|---|
| US-01 選用景點背景 | 製作 › 背景 | 臺北旅遊網 374 個臺北市景點照片；可搜尋景點／行政區、依分類篩選，鎖定的背景顯示「存 N 張解鎖」 |
| US-02 依政策類別載入標語 | 製作 › 政策 | 類別 chip → 政策清單（單選），選定後標語自動帶入 |
| US-03 隨機產生 | 製作 › 隨機 | `GET /policies/random`，並隨機挑問候語、文字樣式、已解鎖背景 |
| US-04 儲存作品 | 製作 › 儲存 | 前端輸出 1080 × 1080 PNG → `POST /artworks`（multipart） |
| US-05 展示作品與解鎖背景 | 我的 | 個人作品格、待解鎖背景、儲存成功時提示新解鎖背景 |
| US-06 作品排行榜 | 排行榜 | `GET /leaderboard`，顯示 competition rank 與分數 |
| US-07 徽章 | 我的、排行榜、作品卡 | 目前等級、下一級進度條、十級徽章一覽 |
| US-08 愛心 | 作品牆、作品頁 | `PUT/DELETE /artworks/{id}/like`，樂觀更新、失敗復原；作者不可對自己按 |
| US-09 下載附 QR Code | 下載面板 | `GET /artworks/{id}/download`，提供長按儲存、系統分享、下載檔案三種方式 |

### 長輩圖編輯器

參考 generate.rei.idv.tw/older 與經典長輩圖的視覺：

- **兩個文字圖層**：問候語（預設直書、大字）與政策標語（預設橫書）。
- **8 種文字樣式**：紅橘白邊、金黃藍邊、寶藍白光、桃紅白邊、七彩繽紛、金字喜氣、翠綠白邊、白字黑邊。多層描邊＋漸層填色＋外光暈，以 canvas 繪製，預覽與輸出一致。
- **直書／橫書**、粗黑體／明體／楷書（使用裝置內建字型，不下載字型檔）。
- **字太多自動縮小**，文字框永遠夾在畫布內；直書自動換成直排標點，標點不放行首。
- **手指直接拖曳文字**；另有九宮格定位與上下左右微調按鈕，作為拖曳的單指替代操作。
- **QR Code 位置提示**：預覽右下角以虛線標出下載後 QR Code 會覆蓋的區域，可關閉。
- **草稿自動保存**：切換分頁、網路失敗、WebView 被系統回收後都還在。

### 手機原生風格

TownPass 漸層標題列、底部 4 分頁導覽、iOS 風格分段控制、grouped list、底部面板（bottom sheet）、開關、toast、骨架載入。只有內容區捲動，標題列與導覽固定。

## 2. 系統架構

```text
TownPass Flutter App
└─ InAppWebView
   ├─ Vue 3 + vue-router（hash 模式）
   ├─ flutterObject bridge：open_link
   └─ /api（openapi.yaml）
       ├─ http 模式：後端（S3 + 資料庫）
       └─ mock 模式：瀏覽器內模擬後端（IndexedDB）
```

| 類別 | 技術與版本 | 用途 |
|---|---|---|
| 前端 | Vue 3.5.13、vue-router 4.5.1、TypeScript 5.8.3、Vite 6.3.5 | SPA |
| 狀態 | Vue `reactive`（無 Pinia） | 編輯草稿、demo 使用者 |
| 樣式 | 原生 CSS，`src/css/tokens.css` | TownPass Figma 已驗證 tokens |
| 圖像 | Canvas 2D | 長輩圖繪製、1080 PNG 輸出 |
| QR | qrcode 1.5.4（只在 mock 模式載入） | mock 下載合成 |

`src/api/types.ts` 的 `Api` 介面是前端唯一依賴的 API 層；`http.ts` 與 `mock/` 兩個實作行為一致，切換只靠環境變數。

## 3. 安裝與執行

需求：Node.js 18 以上（本機驗證 v22.23.4）、npm。

```sh
cd GoodMorning
npm ci
npm run dev            # http://localhost:5173 ，預設 mock 模式，不需後端
```

串接真後端：

```sh
VITE_API_MODE=http API_PROXY_TARGET=http://localhost:8080 npm run dev
```

### 環境變數

| 名稱 | 預設 | 說明 |
|---|---|---|
| `VITE_API_MODE` | `mock` | `mock`＝瀏覽器內示範資料；`http`＝呼叫後端 |
| `VITE_API_BASE_URL` | `/api` | openapi `servers.url` |
| `VITE_DEMO_USERS` | `user-a,user-b,user-c` | `X-Demo-User` allowlist，需與後端一致 |
| `VITE_TRAVEL_IMAGE_BASE` | `travel-img/` | 景點照片位置（預設同網域代理） |
| `API_PROXY_TARGET` | 無 | 只給 `npm run dev` 用的 /api 代理目標 |

`VITE_*` 會進入前端 bundle，不可放任何密鑰。

### 品質檢查

```sh
npm run typecheck
npm test          # 16 個單元測試：排行榜、徽章、排版、景點 JSON 完整性
npm run build
```

## 4. 給後端與 DevOps 的串接重點

1. **S3 bucket 必須開 CORS**（`GET`，`AllowedOrigins` 為前端網域）。編輯器用 canvas 合成背景圖，presigned URL 若沒有 `Access-Control-Allow-Origin`，畫布會被汙染而無法輸出 PNG。前端已設定 `crossOrigin="anonymous"`。
2. **下載 API 需支援 fetch**：前端以 `fetch` 帶 `X-Demo-User` 取得 PNG，`Content-Disposition` 檔名會被讀取。
3. **景點照片要走同網域代理**：臺北旅遊網圖片沒有 `Access-Control-Allow-Origin`，直連會讓 canvas 無法輸出。前端一律請求 `travel-img/{圖片id}`，`vite dev`／`vite preview` 與 `nginx.conf.template` 都已把它代理到 `https://www.travel.taipei/image/{id}`。後端若把背景搬到 S3（需求 5.6），把 `VITE_TRAVEL_IMAGE_BASE` 指向新位置即可。
4. **背景資料表**：`Background.id` 直接沿用臺北旅遊網景點 id，後端可用 `public/data/taipei-attractions.json` 匯入；解鎖門檻見 `src/data/attractions.ts`（`SEASONAL_IDS`）。
5. **QR Code 版面建議**（mock 已依此實作，見 `src/editor/qr.ts`）：右下角距邊 28px、白底圓角卡 252 × 292、QR 220 × 220、quiet zone 2 模組、錯誤修正 M、下方「掃我看政策」。前端預覽的虛線提示框使用同一組數字，後端若改版面請同步 `QR_LAYOUT`。
6. **錯誤碼**：前端依 HTTP status 顯示白話訊息（`src/api/errors.ts`），`code` 目前用到 `ARTWORK_IMAGE_INVALID`；其他 code 歡迎補進對照。
7. **presigned URL 15 分鐘到期**：圖片載入失敗時，前端會重抓一次清單取得新 URL。
8. **部署**：`Dockerfile` 以 nginx 提供靜態檔，`/api/` 反向代理到 `BACKEND_URL`（預設 `http://backend:8080`），上傳上限 12 MB。根目錄 `.github/workflows/deploy.yml` 目前的前端路徑是 `./frontend`，要部署本服務請把 `WORKING_DIRECTORY` 改為 `./GoodMorning`。

```sh
docker build -t good-morning --build-arg VITE_API_MODE=http .
docker run -p 8080:80 -e BACKEND_URL=http://host.docker.internal:9000 good-morning
```

## 5. 待決事項的前端暫定做法

需求文件第 8 節列出的待決事項，前端先依 openapi 與下列假設實作，確認後只需調整對應檔案：

| 待決 | 暫定做法 | 位置 |
|---|---|---|
| 1 觀賞者登入、愛心 | 依 openapi：需 `X-Demo-User`；可取消；作者不可按（409） | `artworkActions.ts` |
| 2 隨機是否選背景 | API 不選背景；**前端在已解鎖背景中隨機挑一張**，使用者可再換 | `EditorView.vue` `randomize()` |
| 3 草稿、編輯、刪除、公開 | 只有本機草稿；不提供編輯既有作品與刪除；所有作品公開 | `editor/draft.ts` |
| 6 徽章公比 | 採公比 2 | `config/badges.ts` |
| 7 顯示哪個徽章 | 顯示最高等級；「我的」另可看十級一覽 | `MeView.vue` |
| 8 排行榜 | 全期間前 100 名（依 openapi） | `LeaderboardView.vue` |
| 5 解鎖背景 | 「季節限定」5 個景點：陽明山夜景、迪化街年貨大街、竹子湖海芋季、平菁街42巷櫻花、復興三路櫻花隧道，存滿 3 張解鎖 | `data/attractions.ts` |
| 9 QR 規格 | 見上方第 4 點 | `editor/qr.ts` |
| 10 下載格式 | 1080 × 1080 PNG（依 openapi） | — |

## 6. TownPass WebView 整合

| 方法 | 使用情境 | Request | Reply |
|---|---|---|---|
| `open_link` | 「看政策說明」開啟政策來源網址 | `https://` URL 字串 | 無成功回覆 |

不在台北通內（沒有 `window.flutterObject`）時改用 `window.open`。在台北通內會隱藏網頁自己的標題列，改由 App AppBar 顯示 `document.title`，頁面仍保留一個供輔助科技讀取的 `h1`。

尚未修改 TownPass App，也尚未在台北通實機內測試。

## 7. 設計與無障礙

- Tokens：`src/css/tokens.css`（TownPass Figma page `1:2`，2026-10-25 驗證值）；字級以 rem 表示，基準放大到 18px。
- 觸控目標：以 Playwright 掃描製作頁四個分頁，所有按鈕、連結與輸入框皆 ≥ 48 × 48（開關本體 52 × 32，可點範圍為整列 56px 高的 label）。
- Dialog：底部面板有名稱、開啟時焦點移入、Tab 鎖在面板內、Esc／遮罩可關閉、關閉後焦點回到觸發按鈕（已自動化驗證回到「下載」按鈕）。
- 分段控制：tablist／radiogroup 語意，方向鍵、Home、End 可切換。
- 畫布：`role="img"` 並以 `aria-label` 描述背景、問候語與標語；拖曳有按鈕替代。
- 動態訊息：toast 為 `role="status"`，錯誤為 `role="alert"`；`prefers-reduced-motion` 時關閉動畫。
- 不鎖定縮放（viewport 未設 `maximum-scale`）；每個路由有獨立 `document.title`，hash 路由讓返回鍵可用。
- 200% 文字：以 iPhone SE 尺寸＋根字級 225% 檢查，製作頁整頁可捲動，功能不遺失；底部導覽文字會換行。
- 尚未以 VoiceOver／TalkBack 實測。

## 8. 裝置相容性

- 建置目標：`es2020`、`safari15`、`chrome87`（台北通 iOS 最低 15.0，取自 taipei-doit/TownPass `IPHONEOS_DEPLOYMENT_TARGET`）。
- Production bundle：首屏 JS 117.7 kB（gzip 47 kB）＋ CSS 11.7 kB；編輯器、排行榜、我的頁面分開延遲載入；不載入任何字型檔與圖示套件。
- 編輯器預覽解析度跟著實際顯示尺寸（最多 2 倍螢幕密度），拖曳時以 `requestAnimationFrame` 合併重繪，只有儲存時才繪製 1080 圖。
- 降級：`ResizeObserver` 不存在時改用 resize 事件；Web Share 不支援檔案時隱藏分享鈕；IndexedDB／localStorage 不可用時 mock 與草稿退回記憶體。
- 已測試：Playwright Chromium 模擬 iPhone SE、iPhone 13（瀏覽器模擬，不代表實機）。

## 9. 資料來源與示範資料

**本服務目前全部是示範資料**，畫面頂端會顯示「示範資料」標示：

- 政策（`src/api/mock/fixtures.ts`）：9 筆有效、1 筆已過期（驗證日期過濾）。標語為測試文案，`sourceUrl` 暫時指向各主管機關首頁，上線前由政策內容人員替換為具體政策頁並驗證。
- 背景（`public/data/taipei-attractions.json`）：**真實資料**，來自臺北旅遊網 Open API `GET /open-api/zh-tw/Attractions/All`（需 `accept: application/json`，每頁 30 筆，2026-11-07 抓取 470 筆）。保留地址在臺北市且有照片的 374 筆，每筆存 id、名稱、行政區、分類、前 3 張照片、介紹頁網址、更新日期。API 說明指向臺北市政府資料開放平台（data.taipei）；照片能否用於長輩圖二次創作與標示方式，上線前請視覺素材人員確認（需求 7.5）。編輯器背景面板已標示「景點照片：臺北旅遊網」。
- 更新背景資料：`node scripts/fetch-attractions.mjs`（Node 18 以上，會覆寫 JSON）。
- 徽章圖示：程式產生的示意 SVG；正式版由後端回傳 S3 presigned URL。
- 示範作品：首次開啟時用同一套編輯器自動產生 5 張，愛心與下載數為假資料。「我的 › 重設示範資料」可清空重來。

## 10. 專案結構

```text
GoodMorning/
├─ public/data/taipei-attractions.json   臺北旅遊網景點（背景圖庫）
├─ scripts/fetch-attractions.mjs        重新抓取上面的 JSON
├─ src/
│  ├─ api/          types（對應 openapi）、http、mock、errors
│  ├─ components/   TopBar、TabBar、Segmented、BottomSheet、DownloadSheet、ArtworkCard…
│  ├─ composables/  bridge（TownPass）、toast、artworkActions（愛心、下載）
│  ├─ config/       badges（徽章、排行榜計分）
│  ├─ data/         attractions（讀取景點 JSON、圖片代理、季節限定解鎖）
│  ├─ css/          tokens、base
│  ├─ editor/       layout（排版純函式）、render（canvas）、styles、scene、draft、qr
│  ├─ router/
│  └─ views/        Feed、Editor、Artwork、Leaderboard、Me
├─ tests/
├─ Dockerfile、nginx.conf.template
└─ .env.example
```

## 11. 第三方套件

| 名稱與版本 | 用途 | 授權 |
|---|---|---|
| vue 3.5.13 | UI 框架 | MIT |
| vue-router 4.5.1 | 路由 | MIT |
| qrcode 1.5.4 | mock 模式 QR 合成 | MIT |
| vite 6.3.5、@vitejs/plugin-vue 5.2.4、typescript 5.8.3、vue-tsc 2.2.10、vitest 3.1.4 | 開發工具 | MIT／Apache-2.0 |

## 12. AI 使用聲明

開發階段使用 Claude 協助撰寫程式與文件，由團隊人工 review。產品執行階段不使用 AI。

## License

AGPL-3.0-only（依 2026 城市通微服務大黑客松工作坊指引；正式提交前請再對照主辦單位最新規則）。
