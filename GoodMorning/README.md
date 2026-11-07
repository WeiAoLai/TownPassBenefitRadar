# 早安政策圖 / Good Morning Policy Cards

> 長輩每天在 LINE 群組傳早安圖，市府的政策宣傳卻很少走這條管道。早安政策圖讓長輩挑一張台北地標或自己拍的照片、選一則市政標語，做出熟悉的長輩圖存到手機相簿分享；圖上的 QR Code 讓親友一掃就連回官方政策說明。

本資料夾是 TownPass（台北通）WebView 微服務的前端。需求以 `good-morning.md`（長輩圖政策宣傳專案需求文件）為準，API 契約以 `openapi.yaml` v0.1.0 為準；TownPass App 端的修改在同一個倉庫的 `TownPass/`。

## 1. 專案簡介 / Project Overview

### 問題與目標

**目標使用者**：會用台北通、習慣在群組傳早安圖的長輩。

**情境與問題**：市府有很多和長輩切身相關的政策（敬老卡、長照 1966、165 反詐騙、流感疫苗），宣傳多半靠官網、新聞稿和海報，長輩不容易看到，就算看到也不會轉傳。長輩之間流通最廣的內容是早安圖，但圖上的字通常沒有可查證的出處。

**本專案的做法**：把「做早安圖」變成政策傳播的管道。長輩用自己喜歡的方式做圖，標語來自市府政策，每張圖都附 QR Code 連回主管機關的說明頁，圖再怎麼被轉傳都找得到出處。徽章、排行榜與每日提醒讓長輩願意天天回來做一張；每人每天最多 3 張，鼓勵用心做、避免洗版。

### 核心功能

1. **三步驟做出長輩圖**：選背景 → 選政策（標語自動帶入）→ 調整文字，或按「隨機一張」一鍵完成。編輯器提供 8 種經典長輩圖字樣、直書／橫書、拖曳與按鈕兩種調整方式。
2. **台北地標或自己的照片當背景**：10 張台北地標照片，可依目前位置把最近的地標排在前面；也可以拍照或從相簿挑照片。
3. **存到手機相簿，附政策 QR Code**：輸出 1080 × 1080 圖片，右下角是台北通外框的 QR Code，掃描後開啟政策說明頁。
4. **每天早上提醒**：在台北通 App 裡開啟後，每天固定時間跳通知，點通知直接進製作頁。
5. **徽章、排行榜與作品牆**：累積作品升級十級徽章、解鎖新背景；作品牆可以按愛心，排行榜依愛心與下載數排名。

### Demo

- Demo URL：尚未公開部署。部署方式見第 9 節（Docker），完成後在台北通 App 的服務設定填入網址。
- 本機預覽：`npm run dev` 後以手機瀏覽器開啟 `http://<電腦 IP>:5173`，預設為示範資料模式，不需要後端。
- 測試限制：每日提醒、台北通帳號、App 內定位需要在台北通 App 的 WebView 裡才能使用；一般瀏覽器會自動改用瀏覽器定位與示範帳號，提醒開關會停用並說明原因。

## 2. 系統架構 / System Architecture

```text
TownPass Flutter App（TownPass/）
└─ InAppWebView
   ├─ Vue 3 + vue-router（hash 模式）
   ├─ flutterObject message bridge：open_link、userinfo、location、daily_reminder（自訂）
   └─ /api（openapi.yaml v0.1.0）
       ├─ http 模式：後端（Spring Boot、S3、資料庫；在 backend/）
       └─ mock 模式：瀏覽器內模擬後端（IndexedDB）
```

| 類別 | 技術與版本 | 用途 |
|---|---|---|
| 前端 | Vue 3.5.13、vue-router 4.5.1、TypeScript 5.8.3、Vite 6.3.5 | SPA，路由用 hash 模式讓返回鍵可用 |
| 狀態 | Vue `reactive`／`ref`（未使用 Pinia） | 編輯草稿（localStorage）、帳號、提醒狀態 |
| 樣式 | 原生 CSS：`src/css/tokens.css`、`src/css/base.css` | TownPass Figma tokens 與元件樣式 |
| 圖像 | Canvas 2D | 長輩圖繪製、1080 PNG 輸出、QR 卡片合成 |
| 音效 | Web Audio API（現場合成，無音檔） | 獲得徽章的慶祝音效，可關閉 |
| 後端 | 依 `openapi.yaml`；未部署時用 mock | 作品、愛心、排行榜、下載 |
| 外部資料 | 無即時外部 API；背景照片隨前端打包 | 見第 5 節 |

`src/api/types.ts` 的 `Api` 介面是前端唯一依賴的 API 層；`http.ts` 與 `mock/` 兩個實作行為一致，切換只靠環境變數。

## 3. 安裝與執行 / Installation & Run

### 需求

- Node.js 18 以上（本機驗證 v22.23.4；Docker build 用 `node:22-alpine`）
- npm（依 `package-lock.json`）
- TownPass App 端：Flutter 3.47.6（由 `TownPass/.fvmrc` 指定，用 fvm 安裝）

### 本機執行

```sh
cd GoodMorning
npm ci
npm run dev            # http://localhost:5173 ，預設 mock 模式，不需後端
```

串接部署在 AWS 的後端（API base 為 ALB 的 `/api/v1`，設定寫在 `package.json` 的 `dev:alb`）：

```sh
npm run dev:alb        # 前端呼叫 /api/...，由 vite 轉到 http://<ALB>/api/v1/...
```

串接本機後端（`backend/` 的 docker compose，base 為 `/api`）：

```sh
VITE_API_MODE=http API_PROXY_TARGET=http://localhost:8088/api npm run dev
```

前端一律呼叫同網域的 `/api`，由 vite（開發）或 nginx（部署）轉發，所以後端不需要為前端開 CORS，也不會遇到 https 頁面呼叫 http API 的混合內容問題。每個請求都帶 `X-Demo-User`（「我的 › 示範帳號」選的 `user-a`／`user-b`／`user-c`）。

TownPass App（每日提醒需要）：

```sh
cd TownPass
fvm install
fvm flutter pub get
fvm flutter run
```

### 環境變數

| 名稱 | 必要 | 說明 | 範例 |
|---|---|---|---|
| `VITE_API_MODE` | 否 | `mock`＝瀏覽器內示範資料；`http`＝呼叫後端。預設 `mock` | `http` |
| `VITE_API_BASE_URL` | 否 | openapi `servers.url`，預設 `/api` | `/api` |
| `VITE_DEMO_USERS` | 否 | `X-Demo-User` allowlist，逗號分隔，需與後端一致 | `user-a,user-b,user-c` |
| `VITE_SHARE_URL` | 否 | 慶祝畫面「分享給親友」的連結；空值時用目前網站首頁 | `https://example.invalid/good-morning/` |
| `API_PROXY_TARGET` | 否 | 只給 dev server 用的 `/api` 代理目標，可帶路徑（`/api` 會換成該路徑）；不進 bundle | `http://<ALB>/api/v1` |

任何 `VITE_*` 值都會進入前端 bundle，不能放 API secret、權杖或個人資料。範本見 `.env.example`。

### 品質檢查

```sh
npm run typecheck   # vue-tsc
npm test            # vitest：排行榜、徽章、排版、背景圖庫 JSON、對比、分享、每日上限，共 44 個
npm run build       # vue-tsc + vite build
```

2026-11-08 結果：typecheck、build 通過；測試 44 個全數通過（`tests/badges.test.ts` 會檢查 `public/badges/` 的圖檔，需在完整 checkout 執行）。

## 4. TownPass WebView 整合

本專案透過 `window.flutterObject.postMessage` 傳送 JSON 字串，回覆由 `flutterObject` 的 `message` 事件接收；每次請求先註冊監聽再送出，收到回覆或逾時後移除監聽（`src/composables/bridge.ts`）。

```json
{
  "name": "location",
  "data": null
}
```

| 方法 | 使用情境 | Request | Reply / no reply |
|---|---|---|---|
| `open_link` | 「看政策說明」、照片攝影師出處 | `https://` URL 字串 | 無成功回覆 |
| `userinfo` | 在台北通裡以台北通帳號取代示範帳號；公開顯示暱稱（`username`），不使用真實姓名 | `null` | 帳號物件（也接受包在 `data` 裡的格式）；逾時 8 秒視為未登入 |
| `location` | 背景面板「離我最近的地標排前面」，使用者按下才定位 | `null` | `{ latitude, longitude }`；逾時 15 秒或拒絕時維持原順序 |
| `daily_reminder`（自訂） | 我的 › 設定「每天早上提醒我」 | 見下表 | `{ enabled, hour?, minute?, permission? }` |

`daily_reminder` 的 `data`：

| action | 其他欄位 | 行為 |
|---|---|---|
| `status` | — | 查目前是否有排程；4 秒沒回覆代表這版 App 沒有此 handler，開關顯示「還不支援」並停用 |
| `set` | `hour`（0–23，預設 7）、`minute`（0–59）、`title`、`content`、`url` | 先要通知權限，拒絕就回 `permission: false`，畫面提示到手機設定開啟；同意後排每天固定時間（台北時間）的本機通知，重設會覆蓋 |
| `cancel` | — | 取消排程 |

**瀏覽器開發模式**：沒有 `window.flutterObject` 時，`open_link` 改用 `window.open`、`userinfo` 回到示範帳號、`location` 改用瀏覽器 Geolocation、提醒開關停用並提示「在台北通 App 裡打開才能設定」。

**權限、拒絕與取消**：定位只在按下按鈕時詢問，按鈕下方說明用途（只用來排序，不儲存、不上傳）；拒絕或逾時顯示「沒有取得位置，可以直接從下面挑背景」，背景清單照常可選。通知權限在打開提醒開關時才詢問。拍照／相簿由系統選單處理，取消就維持原背景。

**標題**：在台北通內隱藏網頁自己的標題列，由 App AppBar 顯示 `document.title`；頁面仍保留供輔助科技讀取的 `h1`。

**http 模式的身分**：openapi v0.1.0 只定義 `X-Demo-User`，台北通登入需要後端新增驗證方式；在那之前 http 模式仍送示範帳號，台北通帳號只用於 mock 模式。

### TownPass App 註冊與原生變更

- 服務設定：尚未加入 `MyServiceItemId`。部署取得 HTTPS 網址後，依 `lib/page/city_service/model/my_service_model.dart` 新增服務、`destinationUrl` 填部署網址，不使用 `forceWebViewTitle`（標題由各頁 `document.title` 提供）。
- 圖示與產生程式碼：尚未新增服務圖示。
- 自訂 Handler：`daily_reminder`，修改如下（基於 taipei-doit/TownPass commit `c8e5d4d`）：

| 檔案 | 修改 |
|---|---|
| `lib/util/web_message_handler/daily_reminder_message_handler.dart` | 新增 `DailyReminderMessageHandler`：驗證 `message` 格式、以 `sourceOrigin` 的 host 區分各微服務的提醒；`url` 必須與來源同 host，否則改用來源網址；標題、內容限制長度 |
| `lib/util/web_message_handler/tp_web_message_listener.dart` | 在 `_cachedMessageHandlers` 註冊 |
| `lib/service/notification_service.dart` | 初始化 `timezone`（Asia/Taipei）；`zonedSchedule` 每日重複、`inexactAllowWhileIdle`（不需 `SCHEDULE_EXACT_ALARM`）；點通知以 `TPRoute.openUri` 開啟網址，冷啟動時等首頁建好再開；`requestPermission()` 回傳是否同意 |
| `lib/main.dart` | `onInit` 呼叫 `NotificationService.handleLaunchPayload()` |
| `pubspec.yaml` | 新增 `timezone: ^0.11.0`（`flutter_local_notifications` 22 要求的版本） |
| `android/app/src/main/AndroidManifest.xml` | `POST_NOTIFICATIONS`、`RECEIVE_BOOT_COMPLETED`，排程與開機重排的 receiver |

  iOS 不需修改：`AppDelegate.swift` 已設定通知 delegate 與 plugin 註冊；`Info.plist` 已有相機與相簿用途說明。

- App 內驗證：**尚未在實機編譯與執行**。網頁端已用模擬的 `flutterObject` 驗證 `userinfo`、`location`、`daily_reminder` 的收送格式。待驗證項目：iOS／Android 通知排程與點擊開啟、Android 台北通內從網頁開相機、App 內的返回與關閉行為。

## 5. 功能與資料來源 / Features & Data

| 編號 | 功能 | 實作摘要 | 資料來源與授權 |
|---|---|---|---|
| 5.1 | 選背景 | 10 張地標照片，鎖定的背景顯示「存 N 張解鎖」並標示攝影師 | Unsplash 照片，[Unsplash License](https://unsplash.com/license)；清單 `public/data/backgrounds.json` |
| 5.2 | 離我最近的地標 | 取得位置 → haversine 計算直線距離 → 依距離排序，縮圖顯示公尺／公里 | 地標經緯度為團隊標註的約略位置，只用於排序 |
| 5.3 | 自己的照片 | `<input type="file" accept="image/*">` 叫出拍照／相簿選單；手機端裁成 1080 正方形 | 使用者提供；只上傳合成後的作品，不上傳原圖與 EXIF |
| 5.4 | 選政策、帶入標語 | 類別 → 政策清單（單選）→ 標語自動帶入，可再修改文字 | **示範資料**（`src/api/mock/fixtures.ts`），見下方說明 |
| 5.5 | 隨機一張 | `GET /policies/random`，並隨機挑問候語、字樣與已解鎖背景 | 同 5.4 |
| 5.6 | 編輯文字 | 兩個圖層（問候語、標語）、8 種字樣、直書／橫書、3 種內建字型；拖曳移動、拖把手縮放，另有九宮格定位、微調與 −／＋ 按鈕；字太多自動縮小 | — |
| 5.7 | 儲存作品 | 前端輸出 1080 × 1080 PNG → `POST /artworks`；每人每天最多 3 張（台北時間 00:00 重置） | — |
| 5.8 | 存到手機相簿 | `GET /artworks/{id}/download` 取得附 QR Code 的成品；系統分享（選「儲存影像」）、長按儲存、下載檔案三種方式 | QR 外框使用台北通官方 logo（GPL-3.0） |
| 5.9 | 徽章與解鎖 | 十級徽章（公比 2）、進度條；Lv.1–3 有大圖，獲得時全螢幕慶祝並可分享 | 徽章大圖為團隊提供的設計稿 |
| 5.10 | 作品牆、愛心、排行榜 | `PUT/DELETE /artworks/{id}/like` 樂觀更新；`GET /leaderboard` 前 100 名 | — |
| 5.11 | 每天早上提醒 | 見第 4 節 `daily_reminder` | — |

**模擬、快取、衍生或生成資料**：

- 政策與標語：10 則示範政策（9 則有效、1 則已過期，用來驗證日期過濾），主題對應市府現有服務（敬老愛心卡、長照 1966、停讓行人、165 反詐騙、流感疫苗、長者健檢等）。標語由團隊撰寫，`sourceUrl` 暫時指向各主管機關首頁；正式上線前由政策內容人員換成具體政策頁並審核標語。
- 示範使用者與作品：3 個示範帳號；首次開啟時用同一套編輯器自動產生 5 張作品，愛心與下載數為假資料。「我的 › 重設示範資料」可清空。
- 徽章小圖示：程式產生的示意 SVG；正式版由後端回傳。
- 背景照片「陽明山草原」在 Unsplash 標示為台北，確切拍攝地點未驗證。

### 待決事項的前端暫定做法

需求文件第 8 節的待決事項，前端先依下列假設實作，確認後只需調整對應檔案：

| 待決 | 暫定做法 | 位置 |
|---|---|---|
| 觀賞者登入、愛心 | 依 openapi：需 `X-Demo-User`；可取消；作者不可按（409） | `composables/artworkActions.ts` |
| 隨機是否選背景 | API 不選背景，前端在已解鎖背景中隨機挑一張 | `EditorView.vue` `randomize()` |
| 草稿、編輯、刪除、公開 | 只有本機草稿；不提供編輯既有作品與刪除；所有作品公開 | `editor/draft.ts` |
| 解鎖背景 | 圓山大飯店、國立故宮博物院，存滿 3 張解鎖 | `backgrounds.json` `unlockThreshold` |
| 徽章公比、顯示 | 公比 2；顯示最高等級，「我的」可看十級一覽 | `config/badges.ts` |
| 排行榜 | 全期間前 100 名 | `LeaderboardView.vue` |
| 下載格式 | 1080 × 1080 PNG | — |
| 每日上限 | 每人每天 3 張，只限制儲存；編輯、隨機、下載、愛心不受限 | `config/limits.ts` |
| 自己的照片 | openapi 的 `backgroundId` 必填，使用自己的照片時送最後選的圖庫背景 id（只作主題紀錄）；建議後端新增 `customBackground` 或允許 null | `EditorView.vue` `save()` |

## 6. 設計與無障礙 / Design & Accessibility

- Figma UI kit：[城市通 Town Pass UI kit](https://www.figma.com/design/bPPjugysKFKSCuBP5SptG8) 頁面 `1:2`；Top navigation → `TopBar.vue`、Foot tab bar → `TabBar.vue`、Button/m・L → `.btn`、Tab primary／secondary → `Segmented.vue`、Pop up → `BottomSheet.vue`、Section bar → 編輯器底部按鈕列。
- Typography 與 colors：`src/css/tokens.css`（Figma 2026-10-25 驗證值）、`src/css/base.css`。長輩友善化：內文基準 18px、輔助文字 16px（Figma 原為 16／14）。
- 字級自適應：根字級依螢幕寬度縮放，Pixel Pro（412）以上 16px、iPhone 13（390）14.5px、iPhone SE（375）13.5px，最小 13px；上下限以 rem 表示，使用者調大瀏覽器預設字級時一起放大。窄螢幕上的輔助文字會低於 16px，這是為了讓小螢幕能顯示完整內容所做的取捨。
- 對比：主色 primary-500 只做裝飾；按鈕、選取狀態、焦點框、連結用 primary-700（白字 5.89:1）；紅色用 `--c-danger-strong`（白字 5.64:1）。選取狀態除顏色外加打勾、粗框或底線，開關旁直接寫「開／關」。`tests/contrast.test.ts` 讀取 `tokens.css` 驗證文字 ≥ 4.5:1、非文字 ≥ 3:1。
- 觸控目標：以 Playwright 掃描製作頁四個分頁，按鈕、連結與輸入框皆 ≥ 48 × 48；開關本體 52 × 32，可點範圍為整列 56px 高的 label。
- 12 類檢查重點：

| 類別 | 實作 |
|---|---|
| AT 替代 | 畫布 `role="img"` 並以 `aria-label` 描述背景、問候語與標語；裝飾圖示 `aria-hidden` |
| AV 音訊 | 慶祝音效只在使用者按下儲存後、獲得新徽章時播放，約 3.5 秒，可在畫面上關閉，選擇記在手機上 |
| NT 通知 | toast 為 `role="status"`、錯誤為 `role="alert"`，停留 7／10 秒、可點擊關閉；Dialog 有名稱、焦點移入、Tab 鎖定、Esc 關閉、焦點還原 |
| TS 觸控 | 拖曳文字有九宮格定位與上下左右按鈕替代；縮放有 −／＋ 按鈕 |
| FC 焦點 | 原生 `button`／`input`；可見焦點框 |
| FM 表單 | 提醒時間用原生 `<input type="time">` 並有標籤；檔案選擇由可見按鈕觸發 |
| LK 連結 | 「看政策說明」、攝影師出處連結文字說明目的地 |
| DC 動態 | `prefers-reduced-motion` 時關閉動畫，慶祝畫面不轉圈 |
| ST 結構 | 每個路由有獨立 `document.title` 與一個 `h1` |
| AD 適應 | 直式單欄、橫式或寬度 900 以上兩欄；作品牆依寬度多欄 |
| DT 辨識 | 不鎖定縮放；200% 文字以 iPhone SE 尺寸＋根字級 225% 檢查，製作頁可捲動、功能不遺失 |
| PD 可預期 | `lang="zh-Hant-TW"`；底部導覽固定順序；同一功能使用同一圖示與名稱 |

- NCC 2017 APP 無障礙開發指引：1.1 定位、通知在使用前說明用途，拒絕後可手動挑背景；1.3 字級自適應不影響使用者縮放與瀏覽器字級設定；3.3 viewport 未設 `maximum-scale`；5.3 程式內無 `eval()`／`new Function`；5.4 每個畫面有獨立 hash URL，返回鍵可用。
- 已測試：Playwright 自動化檢查觸控目標、Dialog 焦點（開啟移入、關閉還原）、200% 文字。
- 已知限制：尚未以 VoiceOver／TalkBack 實測；尚未在台北通 App 實機驗證。

## 7. 裝置相容性與數位近用 / Device Compatibility

- 支援基準：iOS 15.0 以上（taipei-doit/TownPass `IPHONEOS_DEPLOYMENT_TARGET = 15.0`）；Android 依 Flutter 預設 `minSdkVersion`，未另行查證版本號。建置目標 `es2020`、`safari15`、`chrome87`。
- 實機測試：尚未進行。
- 受限環境測試：Playwright Chromium 模擬 iPhone SE（375）、iPhone 13（390）、Pixel Pro（412）視窗尺寸；屬瀏覽器模擬，不代表實機的記憶體、效能或 WebView 行為。
- 降級策略：
  - `ResizeObserver` 不存在時改用 resize 事件；Web Share 不支援檔案時隱藏分享鈕，改用長按儲存或下載。
  - IndexedDB／localStorage 不可用時，mock 資料與草稿只保留在記憶體。
  - 定位、通知、台北通帳號任何一項取得失敗，核心流程（選背景、選政策、儲存、下載）照常可用。
  - 網路失敗時草稿保留，可直接再按一次儲存；圖片網址過期時自動重抓一次。
  - 自己的照片先縮到 1080 × 1080 再繪製，上限 30 MB，避免舊手機記憶體不足。
- 效能紀錄（2026-11-08 production build）：首屏 JS 120.4 kB（gzip 48.1 kB）、CSS 13.9 kB（gzip 3.7 kB）；製作頁 JS 25.9 kB、我的頁 12.4 kB 等分頁延遲載入；不載入字型檔與圖示套件；編輯器預覽解析度跟著顯示尺寸（最多 2 倍），拖曳時以 `requestAnimationFrame` 合併重繪，只在儲存時繪製 1080 圖。

本專案以降低數位落差為目標，避免把高階硬體、高速網路或最新 Web API 當成完成核心流程的必要條件。以上只列出實際驗證過的範圍。

## 8. 專案結構

```text
GoodMorning/
├─ public/
│  ├─ backgrounds/          背景照片（Unsplash）
│  ├─ badges/               徽章大圖 Lv.1–3
│  ├─ brand/                台北通 logo（官方 logo_S.svg）
│  └─ data/backgrounds.json 背景圖庫清單、攝影師、經緯度
├─ src/
│  ├─ api/          types（對應 openapi）、http、mock、errors
│  ├─ components/   TopBar、TabBar、Segmented、BottomSheet、DownloadSheet、ArtworkCard、BadgeCelebration…
│  ├─ composables/  bridge（TownPass）、toast、artworkActions、share、sound
│  ├─ config/       badges（徽章、排行榜計分）、limits（每日上限）
│  ├─ css/          tokens、base
│  ├─ data/         backgrounds（讀取背景圖庫）
│  ├─ editor/       layout、render（canvas）、styles、scene、draft、qr、customPhoto、townpassLogo
│  ├─ router/
│  └─ views/        Feed、Editor、Artwork、Leaderboard、Me
├─ tests/
├─ Dockerfile、nginx.conf.template、docker/10-api-proxy.sh
└─ .env.example
```

## 9. 部署、維運與安全

### Docker

```sh
# mock 模式（不需後端，demo 用）
docker build -t good-morning .
docker run --rm -p 8080:80 good-morning          # http://localhost:8080

# 串接 AWS ALB 上的後端（/api/... 轉到 /api/v1/...）
docker build -t good-morning --build-arg VITE_API_MODE=http .
docker run --rm -p 8080:80 \
  -e BACKEND_URL=http://taipei-code-fest-alb-747927445.ap-southeast-2.elb.amazonaws.com/api/v1 \
  good-morning

# 串接同一台機器上的後端容器（根目錄 docker-compose.yml，/api 原樣轉發）
docker run --rm -p 8080:80 -e BACKEND_URL=http://backend:8080 good-morning
```

| 執行期環境變數 | 預設 | 說明 |
|---|---|---|
| `PORT` | `80` | nginx 監聽埠 |
| `BACKEND_URL` | 空 | 設定後才啟用 `/api/` 反向代理。不帶路徑時原樣轉發 `/api/...`；帶路徑（如 `/api/v1`）時 `/api/` 換成該路徑。空值時不代理，nginx 不會因找不到後端而無法啟動 |

- 映像檔：`node:22-alpine` 建置、`nginx:1.27-alpine` 提供靜態檔；上傳上限 12 MB；健康檢查 `GET /healthz` 回 `200 ok`。
- 倉庫根目錄 `docker-compose.yml` 以 `./GoodMorning` 建置前端服務。
- 必須以 HTTPS 提供，部署後更新台北通服務設定的 `destinationUrl`，並在 App 內重新測試所有 bridge 方法。

### 給後端的串接重點

1. **S3 bucket 必須開 CORS**（`GET`，`AllowedOrigins` 為前端網域）。編輯器用 canvas 合成背景圖，presigned URL 沒有 `Access-Control-Allow-Origin` 時畫布無法輸出 PNG。
2. **下載 API 需支援 fetch**：前端以 `fetch` 取得 PNG，會讀取 `Content-Disposition` 檔名。
3. **背景資料表**：前端以**名稱**對應 `public/data/backgrounds.json`，取得攝影師標示與經緯度；名稱對不到的背景照常可用，只是不顯示攝影師、不參與「離我最近」排序（至少兩個背景有經緯度時才顯示該按鈕）。目前後端只種了 1 張（台北晨曦）；`docs/backend-landmark-backgrounds.sql` 是 10 張台北地標的建議 migration，照片需先上傳到 S3 的同名 object key。
4. **QR Code 版面**（mock 已實作，見 `src/editor/qr.ts`）：右下角距邊 28px、白底圓角卡 260 × 340、6px #5AB4C5 外框、QR 220 × 220、quiet zone 2 模組、錯誤修正 M；下方第一列「掃我看政策」，第二列台北通 logo＋小字作品日期（台北時間 `YYYY.MM.DD`，20px Grey/600）。前端預覽虛線框使用同一組數字（`QR_LAYOUT`）。**後端合成下載圖時請一併加上日期列並把卡片高度改為 340。**
5. **每日製作上限**：超過時 `POST /artworks` 回 `429`、Problem Details `code: "DAILY_LIMIT_REACHED"`（openapi v0.1.0 尚未定義）。前端用 `GET /me/artworks?size=3` 的 `createdAt` 估算今天的張數，只用於提示；真正的限制由後端負責。上限在 `src/config/limits.ts` 的 `DAILY_ARTWORK_LIMIT`，前後端需一致。
6. **錯誤碼**：前端依 HTTP status 與 `code` 顯示白話訊息（`src/api/errors.ts`）。
7. **presigned URL 15 分鐘到期**：圖片載入失敗時前端重抓一次清單。

### 安全與隱私

- 前端不含任何密鑰；`VITE_*` 只放公開設定。
- 公開畫面只顯示台北通暱稱，不顯示真實姓名。
- 位置只存在頁面記憶體中用於排序，不寫入草稿、不送到後端。
- 自己的照片在手機端合成，只上傳作品圖，不帶原圖與 EXIF；面板提示「儲存後大家都看得到」。
- 每日提醒的通知網址限定與來源網頁同 host，避免被拿來開啟任意網站。
- 不在 console 印出帳號或位置資料。

### 資料維護

政策與標語由市府各局處的宣傳窗口提供或審核後上架，每則需有具體政策頁網址與上架、下架日期；過期的政策後端不回傳。新增背景：照片放進 `public/backgrounds/`，在 `backgrounds.json` 加一筆（id 不重複，填攝影師、出處與經緯度）。新增徽章大圖：放進 `public/badges/`，在 `src/config/badges.ts` 的 `BADGE_ART_FILES` 加一行。

## 10. 團隊與致謝

- imfishhead（Tylia）：早安政策圖前端、TownPass App 每日提醒 handler

使用的開放資料、UI 資源、套件與第三方服務：

| 名稱與版本 | 類型／用途 | 來源 | 授權或使用條款 | 驗證日期 |
|---|---|---|---|---|
| vue 3.5.13 | UI 框架 | https://github.com/vuejs/core | MIT | 2026-11-08 |
| vue-router 4.5.1 | 路由 | https://github.com/vuejs/router | MIT | 2026-11-08 |
| qrcode 1.5.4 | mock 模式 QR 合成 | https://github.com/soldair/node-qrcode | MIT | 2026-11-08 |
| vite 6.3.5 | 建置工具 | https://github.com/vitejs/vite | MIT | 2026-11-08 |
| @vitejs/plugin-vue 5.2.4 | 建置工具 | https://github.com/vitejs/vite-plugin-vue | MIT | 2026-11-08 |
| typescript 5.8.3 | 型別檢查 | https://github.com/microsoft/TypeScript | Apache-2.0 | 2026-11-08 |
| vue-tsc 2.2.10 | 型別檢查 | https://github.com/vuejs/language-tools | MIT | 2026-11-08 |
| vitest 3.1.4 | 單元測試 | https://github.com/vitest-dev/vitest | MIT | 2026-11-08 |
| @types/qrcode 1.5.5 | 型別定義 | https://github.com/DefinitelyTyped/DefinitelyTyped | MIT | 2026-11-08 |
| nginx 1.27-alpine | 容器靜態伺服器 | https://hub.docker.com/_/nginx | BSD-2-Clause | 2026-11-08 |
| 台北地標照片 10 張 | 背景圖 | 各照片 Unsplash 頁面（`public/data/backgrounds.json` 的 `photoUrl`） | [Unsplash License](https://unsplash.com/license) | 2026-11-07 |
| 台北通 logo（`logo_S.svg`） | QR 外框標誌 | https://github.com/taipei-doit/TownPass | GPL-3.0 | 2026-11-07 |
| 城市通 Town Pass UI kit | 設計規範 | https://www.figma.com/design/bPPjugysKFKSCuBP5SptG8 | Figma Community 公開檔 | 2026-10-25 |
| TownPass Flutter App | 宿主 App（`TownPass/`） | https://github.com/taipei-doit/TownPass | GPL-3.0 | 2026-11-08 |
| flutter_local_notifications、timezone | App 端每日通知排程 | https://pub.dev/packages/flutter_local_notifications 、https://pub.dev/packages/timezone | BSD-3-Clause、BSD-2-Clause | 2026-11-08 |

照片攝影師：Thomas Tucker、Hans Brunk、Poh Soo Donald Soh、Christie Chau、enot nil、Clement Souchet、Supasit Chantranon、Treddy Chen、Winston Chen、Maxim Klimashin。編輯器在選用的照片下方標示攝影師並連到原圖頁。

長輩圖編輯器的視覺參考 [generate.rei.idv.tw/older](https://generate.rei.idv.tw/older)，程式為團隊自行撰寫。

## 11. AI 使用聲明

### 開發階段

使用 Claude（Anthropic）協助撰寫程式、測試與文件，所有變更由團隊人工 review 後才合併。未輸入真實個資、帳號或位置資料；測試使用合成的示範帳號與假的位置。

### 執行階段

產品執行階段不使用任何 AI 模型。政策標語由人撰寫與審核，系統不自動生成政策內容。

## License

本服務程式碼依 2026 城市通微服務大黑客松規範採 [AGPL-3.0-only](./LICENSE)，公開倉庫至少保留一年。`TownPass/` 為 taipei-doit/TownPass 的修改版本，沿用其 GPL-3.0 授權與原有 LICENSE。背景照片依 Unsplash License 使用，不隨本專案授權再授權。提交前請再對照主辦單位最新規則。
