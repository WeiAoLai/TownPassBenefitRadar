# 她方 HerWay

> 妳的每一程，都有適合的地方。出門在外需要廁所、生理用品、哺集乳室、尿布台、電梯或休息處時，在同一個介面查附近設施，也看得到每筆資料的限制。

![她方 HerWay 手機畫面：首頁、找地方、查詢結果、地點詳情](docs/preview.png)

> **目前狀態：前端 POC，全部使用示範資料。** 尚未串接台北通、Spring Boot 後端或任何政府即時資料。畫面上的地點、地址、設備、開放時間與公告都是虛構的。

## 1. 專案簡介

### 問題與目標

一位使用者推著嬰兒車搭捷運外出，下一個行程前需要哺集乳室和尿布台，也想知道附近有沒有電梯。現在這些資訊散在不同網站，格式不一，也常常沒寫清楚「資料沒提到」和「確定沒有」的差別。

她方從女性的外出經驗出發，但不限女性使用。使用者選好位置和需求，就能在同一份結果裡比較附近地點的設備、開放時間、入口說明與維修公告；資料沒寫到的部分會明確標示為「未知」。

### 核心功能

1. **選位置**：可以用瀏覽器或台北通定位，也可以手動選四個示範地點。拒絕定位也能繼續查。
2. **複選需求**：廁所、生理用品、哺集乳室、尿布台／親子設施、電梯、涼適點（冷氣、飲水、座位）。
3. **清單與地圖**：兩者用同一份篩選結果，編號一致，點選後進入同一筆詳情。手機上可切換；寬度 1024px 以上同時顯示。
4. **地點詳情**：設備的有／沒有／未知、開放時間、入口說明、維修公告、來源、更新日期與資料限制。
5. **求助資源**：110、113（附衛福部保護服務司官網）、台北市民當家熱線 1999。不用登入、不填資料、不自動通報。
6. **狀態處理**：載入中、無結果、讀取失敗、定位遭拒、位置遺失、找不到地點，各自有說明和下一步。

### 搜尋規則

| 規則 | 實作 |
|---|---|
| 多項需求採 AND | 每一項已選需求都必須明確為 `yes` 才列出（`src/utils/search.ts` 的 `matchesAllNeeds`） |
| 未提供的設備為「未知」 | 資料沒有列出的設備一律視為 `unknown`；未知不算符合，也不會顯示成「沒有」 |
| 未選需求 | 顯示全部示範地點 |
| 排序 | 依大圓直線距離由近到遠，畫面一律標示「直線」；不提供步行距離、時間或無障礙路線保證 |
| 沒有完全符合 | 顯示無結果畫面，提供「移除某項需求」按鈕；不列出部分符合的地點 |

### 試用方式

| 想看的情境 | 網址或操作 |
|---|---|
| AND 規則 | 選「捷運中山站一帶」並勾選哺集乳室＋尿布台，會出現 3 筆；有尿布台但哺集乳室未提供的「林蔭書店」不會出現 |
| 維修公告 | `/place/demo-04` |
| 缺少開放時間 | `/place/demo-03`、`/place/demo-12` |
| 無結果 | 六項需求全選 |
| 讀取失敗 | 任一網址加 `?simulate=error`（只在 mock 模式有效），加 `?simulate=off` 恢復 |
| 拒絕定位 | 按「使用我的目前位置」後拒絕瀏覽器權限 |

## 2. 系統架構

```text
TownPass Flutter App（未來）／一般瀏覽器
└─ WebView
   ├─ Vue 3 + Vue Router（views → components）
   ├─ composables/useTownPassBridge.ts ── window.flutterObject（location、phone_call、launch_map、open_link）
   └─ services/PlaceRepository（畫面唯一依賴的資料介面）
      ├─ MockPlaceRepository ── src/data/mock-places.ts（目前使用）
      └─ ApiPlaceRepository  ── Spring Boot API（尚未對接，格式待確認）
```

| 類別 | 技術與版本 | 用途 |
|---|---|---|
| 前端 | Vue 3.4.21、Vue Router 4.3.0、TypeScript 5.4.5、Vite 5.2.8 | 版本與官方 TownPass-Services starter 對齊 |
| 狀態 | 無狀態管理套件（`src/stores/search.ts` 輕量 reactive） | 只存記憶體中的裝置位置；查詢條件寫在網址 query |
| 樣式 | 原生 CSS + TownPass Figma tokens（`src/css/tokens.css`） | 未使用 Tailwind，避免為 POC 增加套件 |
| 地圖 | Leaflet 1.9.4 + OpenStreetMap 圖磚 | 依 2026 秋季賽事指引採開放地圖；地圖元件延遲載入 |
| 後端 | 無（Spring Boot 之後由團隊處理） | — |
| 測試 | Vitest 1.6.0；另以 Playwright + axe-core 做流程驗收（未列入相依） | 見第 7 節 |

官方 starter 另含 Pinia、Tailwind CSS、Headless UI、v-calendar。這個 POC 沒有日期選擇，也沒有 Dialog，就先不安裝；若團隊要跟其他服務共用元件，再依需要補上。

## 3. 安裝與執行

### 需求

- Node.js 18 以上（開發時使用 22.23.4）
- pnpm 10（開發時使用 10.28.0；`package.json` 已設定允許 esbuild 安裝腳本）

### 本機執行

```sh
pnpm install
pnpm dev
```

本機網址：`http://localhost:5173`

正式建置與預覽：

```sh
pnpm build
pnpm preview
```

### 環境變數

複製 `.env.example` 為 `.env` 後修改。

| 名稱 | 必要 | 說明 | 範例 |
|---|---|---|---|
| `VITE_DATA_SOURCE` | 否 | `mock`（預設）或 `api` | `mock` |
| `VITE_API_BASE_URL` | `api` 模式時必要 | 後端 API 根網址；未設定時會退回示範資料並在 console 警告 | `https://api.example.invalid` |

所有 `VITE_*` 值都會被打包進前端，不能放 API 金鑰、權杖或個人資料。

### 品質檢查

```sh
pnpm type-check   # vue-tsc
pnpm test         # Vitest：搜尋規則、示範資料完整性、資料服務
pnpm build        # type-check + vite build
```

專案沒有設定 lint 或 formatter。

## 4. TownPass WebView 整合

目前**尚未在台北通 App 內實測**，以下是依官方 `taipei-doit/TownPass` 原始碼實作的 bridge，只在一般瀏覽器中用模擬的 `flutterObject` 測過。

所有訊息都是 `{ name, data }` 的 JSON 字串：

```json
{ "name": "location", "data": null }
```

| 方法 | 使用情境 | Request | Reply／處理 |
|---|---|---|---|
| `location` | 「使用我的目前位置」 | `null` | 回覆 geolocator `Position` 物件，取 `latitude`、`longitude`；回覆空值時顯示「無法取得位置」，可改選示範地點 |
| `phone_call` | 求助頁撥打 110／113／1999 | 號碼字串 | `true`：host 處理撥號；`false`：提示直接用電話撥打；逾時視為結果未知 |
| `launch_map` | 詳情頁「用外部地圖導航」（使用者先確認） | OpenStreetMap 路線網址 | 同上 |
| `open_link` | 求助頁外部官網連結 | URL 字串 | 無成功回覆 |

實作在 `src/composables/useTownPassBridge.ts`：先註冊監聽再送出，收到回覆、逾時或取消後移除監聽。沒有 `window.flutterObject` 時，改用瀏覽器 Geolocation、`tel:` 連結和新分頁，不會假裝原生功能成功。

每個路由都有獨立的 `document.title`（例如「找地方｜她方 HerWay」，詳情頁為地點名稱），台北通的 AppBar 會跟著更新。

### TownPass App 註冊與原生變更

- 服務設定：**未修改 App**。正式部署為 HTTPS 後，需要在 `MyServiceItemId` 新增項目並設定 `destinationUrl`。
- 自訂 Handler：無。
- App 內驗證：未進行。

## 5. 功能與資料來源

| 編號 | 功能 | 實作摘要 | 資料來源與授權 |
|---|---|---|---|
| 5.1 | 設施查詢 | 位置＋需求 → AND 篩選 → 直線距離排序 | **示範資料（虛構）**，`src/data/mock-places.ts` |
| 5.2 | 示範位置 | 四個捷運站一帶的大約座標，只用來算距離 | 專案自訂，`src/data/demo-origins.ts` |
| 5.3 | 地圖底圖 | Leaflet 顯示 OSM 圖磚，附 © OpenStreetMap contributors | [OpenStreetMap](https://www.openstreetmap.org/copyright)，ODbL；圖磚使用須遵守 OSMF Tile Usage Policy |
| 5.4 | 求助資源 | 撥號與官方連結 | 衛生福利部保護服務司 <https://dep.mohw.gov.tw/DOPS/mp-105.html>（2026-11-07 開啟確認為官方頁面） |

### 資料格式

畫面使用的形狀定義在 `src/types/place.ts`：

```ts
interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  facilities: Partial<Record<'toilet' | 'period' | 'nursing' | 'diaper' | 'elevator' | 'cool', {
    status: 'yes' | 'no' | 'unknown';
    note?: string;
  }>>;                       // 沒列出的設備 = unknown
  openingHours: string | null;   // null = 未提供
  entranceNote: string | null;
  maintenance: { facility?: FacilityKey; message: string; since?: string; until?: string }[];
  source: { name: string; url?: string };
  updatedAt: string | null;      // YYYY-MM-DD；null = 未知
  isDemo: boolean;
}
```

### Mock 資料限制

- 12 筆地點全部虛構，名稱都以「示範｜」開頭，地址都標「（虛構）」，`isDemo` 都是 `true`，畫面上每筆都有「示範資料」標籤。
- 座標放在中山、台北車站、市政府、公館附近，只為了示範距離排序，不對應任何真實設施。
- 刻意涵蓋：多種設備組合、缺開放時間（demo-03、demo-12）、明確未知（demo-04、demo-09、demo-10）、維修公告（demo-04、demo-11）、更新日期未知（demo-06、demo-12）、六項全選無結果。
- 畫面上的資料限制提醒：生理用品點不代表有庫存、哺集乳室不代表有空位、沒有電梯維修公告不代表電梯正常、距離是直線距離。

## 6. 設計與無障礙

- Figma UI kit：<https://www.figma.com/design/yCpXgoSE0rIhpB7SewpTp3/城市通-Town-Pass-Open-Source-Gov-Mobile-App-UI-kit-and-design-system--Community-?node-id=1-2>
- Token：`src/css/tokens.css`。數值取自 townpass-webview-hackathon skill 2026-10-25 的 Figma 檢視紀錄，未另外補插色階。HerWay 的語意別名（`--hw-*`）是專案自訂，不是 Figma 語意色節點 `3:390` 的正式對應。
- 視覺方向：TownPass 藍綠主色搭配暖黃輔色，底色用 Secondary/50 的暖白，不用粉紅色系，也不把需求預設為育兒。白字只放在 Primary/700 以上的深色上。
- 設備狀態一律是「圖示＋文字」（✓ 有、✕ 沒有、? 未知，未知另外用虛線框），不只靠顏色辨識。
- 觸控目標：按鈕高 48／56px；結果卡片整張可點，但只有一個焦點停留點；Leaflet 縮放鈕、標記與 popup 關閉鈕都放大到 48 × 48。
- 換頁後焦點移到頁面 `h1`；查詢結果以 `role="status"` 播報，讀取失敗以 `role="alert"` 播報。
- 尊重 `prefers-reduced-motion`；沒有自動播放或輪播。

**已測試（Chromium 模擬）**：axe-core WCAG 2.1 AA＋best-practice 六個主要畫面零違規、鍵盤完成整個查詢流程（含地圖標記、Tab 可離開地圖）、所有可點擊元素 ≥ 48 × 48、五個頁面在 200% 文字下無水平溢出、手機橫向。

**尚未測試**：VoiceOver、TalkBack、實機 200% 系統字級、reduced motion 實際切換。

## 7. 裝置相容性與測試結果

- 支援基準：**待確認**。TownPass host 的最低 iOS／Android 與 WebView 版本尚未查證。
- 實機測試：**未進行**（iOS、Android、台北通 WebView 都還沒測）。
- 降級策略：地圖延遲載入；元件載入失敗或底圖抓不到時，顯示提示並保留清單。定位失敗或被拒時可改選示範地點。讀取失敗保留條件，可直接重試。核心流程沒有依賴新版瀏覽器 API；`:has()` 只用來加強外觀，不支援時需求卡片改以 `:focus-within` 顯示焦點，選取狀態另有勾選圖示與 class。

### 測試紀錄（2026-11-07，雲端 Linux 環境）

| 項目 | 結果 |
|---|---|
| `pnpm type-check` | 通過 |
| `pnpm test`（Vitest） | 14／14 通過：AND 規則、未知不算符合、六項無結果、距離排序與文字、示範資料完整性、資料服務、模擬失敗、取消查詢 |
| `pnpm build` | 通過 |
| `pnpm dev` | 啟動成功，`http://localhost:5173` 回應 200 |
| `scripts/e2e-check.cjs`（Playwright 1.63 Chromium；iPhone 13、Pixel 7 模擬，桌機 1280 × 860） | 90／90 通過 |
| 資料來源切換 | 以 `VITE_DATA_SOURCE=api` 建置並接上回傳相同 JSON 的本機 stub API：畫面元件未修改，結果與 mock 一致（3 筆，順序相同），詳情頁透過 `/places/{id}` 取得 |
| 受限環境（模擬，不等於實機） | 400 kbps、400 ms 延遲＋4 倍 CPU 節流：首頁 2.0 秒、結果頁 2.4 秒可操作 |

e2e 涵蓋：不登入且拒絕定位仍可手動選點完成查詢、未選位置的錯誤提示與焦點、AND 規則、清單與地圖的筆數和順序一致、地圖與清單點選後是同一筆詳情、返回保留地圖檢視、維修公告與未知提示、缺開放時間與更新日期、無結果與讀取失敗是不同畫面、移除需求重新查詢、裝置位置遺失提示、裝置位置不寫進網址與瀏覽器儲存、外部導航前先告知、求助頁無任何表單欄位、模擬 TownPass bridge 的 `location` 與 `phone_call`（含監聽移除）。

**限制**：測試環境封鎖外網，所以 **OSM 圖磚從未實際載入**，地圖只在「底圖無法載入」狀態下驗證過，標記、popup 與降級提示都正常。真正連上網路時的地圖外觀需要在本機確認。

### Production bundle

| 檔案 | 大小 | gzip | 載入時機 |
|---|---|---|---|
| `index-*.js` | 103.8 KB | 約 41 KB | 首頁 |
| `index-*.css` | 10.8 KB | 約 2.7 KB | 首頁 |
| `MapPanel-*.js`（含 Leaflet） | 153.1 KB | 約 45 KB | 第一次顯示地圖時 |
| `MapPanel-*.css` | 17.7 KB | 約 7 KB | 第一次顯示地圖時 |

沒有網路字型或圖片資源；圖示是內嵌 SVG。

## 8. 專案結構

```text
src/
├─ components/     AppHeader、AppIcon、PlaceCard、StatusBadge、StateBlock、MapPanel、PhoneAction
├─ composables/    useTownPassBridge（bridge adapter）、useDeviceLocation、useNativeActions
├─ css/            tokens.css（TownPass token）、base.css
├─ data/           facilities（需求文案與限制）、demo-origins、mock-places
├─ router/         路由與 document.title、換頁焦點
├─ services/       PlaceRepository 介面、Mock／Api 實作、資料來源切換
├─ stores/         查詢狀態（裝置位置只存記憶體）
├─ types/          Place 等資料型別
├─ utils/          search.ts（AND 篩選、直線距離）與單元測試
└─ views/          Home、Explore、Results、PlaceDetail、Help、NotFound
scripts/e2e-check.cjs   主要流程驗收腳本
```

## 9. 與 Spring Boot 對接前需要確認的事項

1. **端點與參數**：`ApiPlaceRepository` 目前假設 `GET /places` 回傳全部地點、`GET /places/{id}` 回傳單筆、找不到回 404。後端若要做伺服器端篩選，請確認參數名稱（位置、需求、半徑、分頁）。
2. **篩選規則一致**：後端篩選時必須同樣採用「AND，且未知不算符合」，不能把缺欄位當成 `false` 或 `true`。
3. **設備三態**：API 要能區分有、沒有、未知（例如 `true`／`false`／`null` 或明確 enum），不能只回布林值。
4. **欄位對應**：開放時間是自由文字還是結構化時段？維修公告有沒有起訖日期？`source` 是否附原始資料集網址？`updatedAt` 是資料集更新日還是單筆更新日？
5. **距離計算**：目前在前端計算直線距離。若改由後端計算，請確認單位、計算方式，以及回應裡不要帶回使用者座標。
6. **隱私**：使用者位置只在查詢時送出；後端與 log 不可保存位置軌跡，也不可記錄求助頁的任何操作。
7. **錯誤格式**：HTTP 狀態碼與錯誤 body 的格式，前端目前把非 2xx 與連線失敗都顯示成「資料讀取失敗」。
8. **CORS 與部署**：前端正式網址（HTTPS）確定後，後端 CORS 只開放該來源。
9. **真實資料來源**：每個資料集的發布單位、名稱、網址、更新頻率與授權都要到發布者頁面查證後才能上線；上線後 `isDemo` 要為 `false`，首頁的示範提示只在 mock 模式顯示。

## 10. 部署、維運與安全

- 尚未部署。`pnpm build` 產出 `dist/`，可部署到任何 HTTPS 靜態主機；SPA 路由需要設定 fallback 到 `index.html`。
- 前端沒有任何密鑰；沒有分析、追蹤或 log 上傳。
- 位置只存在記憶體中，不寫入網址、`localStorage` 或 `sessionStorage`。唯一使用的 `sessionStorage` 是 mock 模式的 `?simulate=error` 開關。

## 11. 團隊與致謝

- Tylia：Vue 前端 POC
- 團隊：Spring Boot 後端（待對接）

| 名稱與版本 | 類型／用途 | 來源 | 授權 | 驗證日期 |
|---|---|---|---|---|
| Vue 3.4.21 | 前端框架 | <https://github.com/vuejs/core> | MIT | 2026-11-07 |
| Vue Router 4.3.0 | 路由 | <https://github.com/vuejs/router> | MIT | 2026-11-07 |
| Leaflet 1.9.4 | 地圖 | <https://github.com/Leaflet/Leaflet> | BSD-2-Clause | 2026-11-07 |
| OpenStreetMap 圖磚 | 地圖底圖 | <https://www.openstreetmap.org/copyright> | ODbL（資料）；OSMF Tile Usage Policy | 2026-11-07 |
| TownPass UI kit | 設計 token | 上方 Figma 連結 | 依 Figma Community 檔案條款 | 2026-10-25（skill 紀錄） |
| Vite、TypeScript、vue-tsc、Vitest | 建置與測試（開發相依） | npm | MIT／Apache-2.0 | 2026-11-07 |

## 12. AI 使用聲明

### 開發階段

使用 Claude（Anthropic，模型設定為 `claude-opus-5-5`）協助規劃資訊架構、撰寫程式碼、示範資料、測試腳本與本 README，並在雲端環境實際建置與執行測試。未輸入任何真實個資或真實位置資料。所有內容需由團隊人工 review。

### 執行階段

產品執行時不使用任何 AI。

## License

**待確認。** 2026 秋季賽事工作坊指引寫明競賽成果採 AGPL-3.0、公開至少一年，但本專案還沒對照主辦單位目前的規則與授權文字，因此尚未加入 `LICENSE` 檔。提交前請以主辦單位提供的版本為準。
