# 早安政策圖 / Good Morning Policy Cards

> 讓長輩用熟悉的「早安圖」把台北市政好消息傳給親友：選台北地標或自己的照片當背景、挑一則政策標語，做好就能存到手機相簿，圖上附政策 QR Code；每天早上還有台北通通知提醒。

本資料夾是 TownPass（台北通）WebView 微服務的**前端**。需求以 `good-morning.md`（長輩圖政策宣傳專案需求文件）為準，API 以 `openapi.yaml` v0.1.0 為準。

## 1. 專案簡介

### 核心功能

| 需求 | 畫面 | 實作摘要 |
|---|---|---|
| US-01 選用景點背景 | 製作 › 背景 | 10 張臺北地標照片（Unsplash），鎖定的背景顯示「存 N 張解鎖」，並標示攝影師 |
| US-02 依政策類別載入標語 | 製作 › 政策 | 類別 chip → 政策清單（單選），選定後標語自動帶入 |
| US-03 隨機產生 | 製作 › 隨機 | `GET /policies/random`，並隨機挑問候語、文字樣式、已解鎖背景 |
| US-04 儲存作品 | 製作 › 儲存 | 前端輸出 1080 × 1080 PNG → `POST /artworks`（multipart）；**每人每天最多 3 張**（台北時間） |
| US-05 展示作品與解鎖背景 | 我的 | 個人作品格、待解鎖背景、儲存成功時提示新解鎖背景 |
| US-06 作品排行榜 | 排行榜 | `GET /leaderboard`，顯示 competition rank 與分數 |
| US-07 徽章 | 我的、排行榜、作品卡 | 目前等級、下一級進度條、十級徽章一覽 |
| US-08 愛心 | 作品牆、作品頁 | `PUT/DELETE /artworks/{id}/like`，樂觀更新、失敗復原；作者不可對自己按 |
| US-09 下載附 QR Code | 下載面板 | `GET /artworks/{id}/download`，提供長按儲存、系統分享、下載檔案三種方式 |
| 加值：存到手機相簿 | 儲存成功視窗 | 存好後直接開啟下載面板，用系統分享選「儲存影像」存進相簿 |
| 加值：自己的照片當背景 | 製作 › 背景 | 拍照或從相簿挑，手機端裁成 1080 正方形；不另外上傳原圖 |
| 加值：離我最近的地標 | 製作 › 背景 | 台北通 `location` 取位置，依距離排序背景 |
| 加值：每天早上提醒 | 我的 › 設定 | 台北通自訂 handler `daily_reminder` 排每日本機通知，點通知回到編輯器 |

### 長輩圖編輯器

參考 generate.rei.idv.tw/older 與經典長輩圖的視覺：

- **兩個文字圖層**：問候語（預設直書、大字）與政策標語（預設橫書）。
- **8 種文字樣式**：紅橘白邊、金黃藍邊、寶藍白光、桃紅白邊、七彩繽紛、金字喜氣、翠綠白邊、白字黑邊。多層描邊＋漸層填色＋外光暈，以 canvas 繪製，預覽與輸出一致。
- **直書／橫書**、粗黑體／明體／楷書（使用裝置內建字型，不下載字型檔）。
- **字太多自動縮小**，文字框永遠夾在畫布內；直書自動換成直排標點，標點不放行首。
- **手指直接拖曳文字**，拖右下角圓形把手放大縮小；另有九宮格定位、上下左右微調與字級 −／＋ 按鈕，作為拖曳的單指替代操作。
- **自己的照片**：`<input type="file" accept="image/*">` 叫出系統的拍照／相簿選單，照片在手機端裁切縮小後當背景（`src/editor/customPhoto.ts`）。
- **QR Code 位置提示**：預覽右下角以虛線標出下載後 QR Code 會覆蓋的區域，可關閉。
- **草稿自動保存**：切換分頁、網路失敗、WebView 被系統回收後都還在。

### 依 TownPass Figma UI kit 設計

依 [城市通 Town Pass UI kit](https://www.figma.com/design/bPPjugysKFKSCuBP5SptG8) 頁面 `1:2` 的元件實作：

| Figma 元件 | 本專案 |
|---|---|
| Top navigation（3:5074）：白底 56、返回鈕 56 × 56、標題 H3 Semibold Grey/700 | `TopBar.vue` |
| Foot tab bar（3:5129）：白底、上框 Grey/100、圖示 24、Body 14 | `TabBar.vue`（選取中為 Primary/500） |
| Button/m 48、Button/L 56：圓角 8；Primary、Second、Disable | `base.css` `.btn` |
| Section_one line text_button/m：白底陰影、提示文字＋兩顆按鈕 | 編輯器底部「隨機一張／儲存作品」 |
| Tab primary（底線）／Tab secondary（框） | `Segmented.vue`（工具分頁／單選） |
| Pop up：置中白卡 | `BottomSheet.vue`（下載、儲存成功、切換帳號） |
| searchbar、Table item | 背景搜尋、清單列 |

版面以 **Pixel Pro（412 × 約 780 的 WebView）** 為基準並自適應：直式時預覽與工具分頁黏在上方、底部按鈕列黏在下方，內容在中間捲動；橫式或寬度 900 以上改成左預覽、右工具的兩欄；作品牆依寬度自動多欄。

## 2. 系統架構

```text
TownPass Flutter App
└─ InAppWebView
   ├─ Vue 3 + vue-router（hash 模式）
   ├─ flutterObject bridge：open_link、userinfo、location、daily_reminder（自訂）
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
| `VITE_SHARE_URL` | 空（用目前網站首頁） | 獲得徽章慶祝畫面「分享給親友」分享的連結；正式上線後填台北通裡這個服務的連結 |
| `API_PROXY_TARGET` | 無 | 只給 `npm run dev` 用的 /api 代理目標 |

`VITE_*` 會進入前端 bundle，不可放任何密鑰。

### 品質檢查

```sh
npm run typecheck
npm test          # 單元測試：排行榜、徽章、排版、背景圖庫 JSON、對比、分享、每日上限
npm run build
```

## 4. 給後端與 DevOps 的串接重點

1. **S3 bucket 必須開 CORS**（`GET`，`AllowedOrigins` 為前端網域）。編輯器用 canvas 合成背景圖，presigned URL 若沒有 `Access-Control-Allow-Origin`，畫布會被汙染而無法輸出 PNG。前端已設定 `crossOrigin="anonymous"`。
2. **下載 API 需支援 fetch**：前端以 `fetch` 帶 `X-Demo-User` 取得 PNG，`Content-Disposition` 檔名會被讀取。
3. **背景照片**：10 張臺北地標照片來自 Unsplash（Unsplash License，可免費修改與商用），放在 `public/backgrounds/`，與前端同網域，canvas 可直接輸出 PNG。正式版依需求 5.6 搬到 S3 時，S3 需開 CORS。
4. **背景資料表**：`Background` 資料可直接由 `public/data/backgrounds.json` 匯入（id、名稱、檔名、解鎖門檻、攝影師、出處）。
5. **QR Code 版面建議**（mock 已依此實作，見 `src/editor/qr.ts`）：右下角距邊 28px、白底圓角卡 260 × 320、6px 主色（#5AB4C5）外框、QR 220 × 220、quiet zone 2 模組、錯誤修正 M、下方台北通 logo（官方 `logo_S.svg`，取自 taipei-doit/TownPass，GPL-3.0）＋「掃我看政策」。前端預覽的虛線提示框使用同一組數字，後端若改版面請同步 `QR_LAYOUT`。
6. **錯誤碼**：前端依 HTTP status 顯示白話訊息（`src/api/errors.ts`），`code` 目前用到 `ARTWORK_IMAGE_INVALID`；其他 code 歡迎補進對照。
7. **presigned URL 15 分鐘到期**：圖片載入失敗時，前端會重抓一次清單取得新 URL。
8. **每日製作上限（後端必須實作）**：每人每天最多 3 張，以台北時間 00:00 為界。超過時 `POST /artworks` 回 `429`，Problem Details 的 `code` 為 `DAILY_LIMIT_REACHED`；前端看到這個 code 就顯示「今天已經做了 3 張，明天再來做吧！」並停用儲存鈕。openapi v0.1.0 尚未定義，請後端補上。前端用 `GET /me/artworks?size=3` 前 3 筆的 `createdAt` 算今天做了幾張，只用來提示，真正的限制以後端為準（換手機或清資料都擋得住）。上限數字在 `src/config/limits.ts` 的 `DAILY_ARTWORK_LIMIT`，前後端要一致。
9. **部署**：`Dockerfile` 以 nginx 提供靜態檔，`/api/` 反向代理到 `BACKEND_URL`（預設 `http://backend:8080`），上傳上限 12 MB。根目錄 `.github/workflows/deploy.yml` 目前的前端路徑是 `./frontend`，要部署本服務請把 `WORKING_DIRECTORY` 改為 `./GoodMorning`。

```sh
# mock 模式（不需後端，demo 用）
docker build -t good-morning .
docker run --rm -p 8080:80 good-morning          # http://localhost:8080

# 串接後端
docker build -t good-morning --build-arg VITE_API_MODE=http .
docker run --rm -p 8080:80 -e BACKEND_URL=http://host.docker.internal:9000 good-morning
```

| 執行期環境變數 | 預設 | 說明 |
|---|---|---|
| `PORT` | `80` | nginx 監聽埠 |
| `BACKEND_URL` | 空 | 設定後才啟用 `/api/` 反向代理；空值＝不代理，nginx 不會因找不到後端而無法啟動 |

健康檢查：`GET /healthz` 回 `200 ok`（可給 ALB target group 使用）。

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
| 5 解鎖背景 | 圓山大飯店、國立故宮博物院，存滿 3 張解鎖 | `public/data/backgrounds.json` `unlockThreshold` |
| 9 QR 規格 | 見上方第 4 點 | `editor/qr.ts` |
| 10 下載格式 | 1080 × 1080 PNG（依 openapi） | — |
| 每日上限 | 每人每天 3 張，台北時間 00:00 重置；只限制「儲存」，編輯、隨機、下載不受限。達上限時儲存鈕顯示「今天已做滿」、提示幾小時後可再做 | `config/limits.ts`、`EditorView.vue`、mock `createArtwork` |
| 自己的照片 | openapi `backgroundId` 必填，用自己的照片時**仍送最後選的圖庫背景 id**（只當主題紀錄，不影響解鎖計算）；作品 PNG 本身已含使用者照片。建議後端之後加 `customBackground: boolean` 或讓 `backgroundId` 可為 null | `EditorView.vue` `save()` |

## 6. TownPass WebView 整合

| 方法 | 使用情境 | Request | Reply |
|---|---|---|---|
| `open_link` | 「看政策說明」、攝影師出處 | `https://` URL 字串 | 無成功回覆 |
| `userinfo` | 在台北通裡以台北通帳號取代示範帳號；公開顯示用暱稱（`username`），不使用真實姓名 | `null` | 帳號物件（也接受包在 `data` 裡的格式）；逾時 8 秒視為未登入 |
| `location` | 背景面板「離我最近的地標排前面」，使用者按下才定位；位置只在頁面記憶體中排序，不儲存、不上傳 | `null` | `{ latitude, longitude }`；不在台北通時改用瀏覽器定位，拒絕或逾時就維持原順序 |
| `daily_reminder`（**自訂**） | 我的 › 設定「每天早上提醒我」，可改提醒時間 | 見下表 | `{ enabled, hour?, minute?, permission? }` |

`daily_reminder` 的 `data`：

| action | 其他欄位 | 行為 |
|---|---|---|
| `status` | — | 查目前是否有排程；4 秒沒回覆＝這版 App 沒裝 handler，開關顯示「還不支援」並停用 |
| `set` | `hour`（0–23，預設 7）、`minute`（0–59）、`title`、`content`、`url` | 先要通知權限，拒絕就回 `permission: false`；同意後排每天固定時間（台北時間）的本機通知，重設會覆蓋 |
| `cancel` | — | 取消排程 |

不在台北通內（沒有 `window.flutterObject`）時：`open_link` 改用 `window.open`、`userinfo` 回到示範帳號、`location` 改用瀏覽器定位、提醒開關停用並提示「在台北通 App 裡打開才能設定」。http 模式下，openapi v0.1.0 只定義 `X-Demo-User`，台北通登入要等後端新增驗證方式，在那之前仍送示範帳號。在台北通內會隱藏網頁自己的標題列，改由 App AppBar 顯示 `document.title`，頁面仍保留一個供輔助科技讀取的 `h1`。

### TownPass App 端修改（`TownPass/`）

| 檔案 | 修改 |
|---|---|
| `lib/util/web_message_handler/daily_reminder_message_handler.dart` | 新增 `DailyReminderMessageHandler`。以訊息來源網頁的 host 當 key，每個微服務各一個提醒；`url` 必須與來源同 host，否則改用來源網址，避免被拿來開任意網站；標題、內容限制長度 |
| `lib/util/web_message_handler/tp_web_message_listener.dart` | 註冊 handler |
| `lib/service/notification_service.dart` | 初始化 `timezone`（固定 Asia/Taipei）；`zonedSchedule` 加 `matchDateTimeComponents: time` 每日重複，`inexactAllowWhileIdle`（不需 `SCHEDULE_EXACT_ALARM`）；點通知以 `TPRoute.openUri` 打開 payload 網址，App 被通知冷啟動時等首頁建好再開；`requestPermission()` 改回傳是否同意 |
| `lib/main.dart` | `onInit` 呼叫 `NotificationService.handleLaunchPayload()` |
| `pubspec.yaml` | 新增直接依賴 `timezone: ^0.10.1`（`flutter_local_notifications` 已有） |
| `android/app/src/main/AndroidManifest.xml` | `POST_NOTIFICATIONS`、`RECEIVE_BOOT_COMPLETED`，以及排程與開機重排的兩個 receiver |

iOS 不需修改：`AppDelegate.swift` 已設定 `UNUserNotificationCenter` delegate 與 plugin 註冊。Android 已開 core library desugaring。

**拍照／選照片**：`flutter_inappwebview` 6 在 Android 會處理 `<input type="file">` 並透過既有的 FileProvider 叫出系統選單；iOS 由 WKWebView 原生處理，`Info.plist` 已有相機與相簿用途說明。

```sh
cd TownPass
fvm flutter pub get
fvm flutter run          # 需實機或模擬器；Android 13 以上第一次開提醒會跳通知權限
```

測試提醒：把時間改成兩分鐘後 → 回桌面等通知（Android 的 inexact 排程可能晚幾分鐘）→ 點通知應回到台北通並打開編輯器。

尚未在實機上跑過 App 端修改；Dart 程式依 `flutter_local_notifications` 22 的具名參數 API 撰寫，若 `pub get` 後編譯報參數名稱不符，請以該版文件的 `zonedSchedule`、`cancel` 簽名為準。

## 7. 設計與無障礙

- Tokens：`src/css/tokens.css`（TownPass Figma page `1:2`，2026-10-25 驗證值）；字級以 rem 表示。長輩友善化後內文基準 18px、輔助文字 16px（Figma 原為 16／14），頁面上沒有小於 16px 的文字（已用瀏覽器掃描作品牆、製作四個分頁、排行榜、我的）。
- 對比：主色 primary-500 白字只有 2.39:1，只留給裝飾；按鈕、選取狀態、焦點框、連結改用同色票的 primary-700（`--c-action`，白字 5.89:1）；紅色用 `--c-danger-strong`（白字 5.64:1）；`--c-text-3` 改 grey-600。選取狀態除顏色外加打勾、粗體、粗框或底線；開關旁直接寫「開／關」。`tests/contrast.test.ts` 讀 `tokens.css` 驗證這些配對（文字 ≥ 4.5:1、非文字 ≥ 3:1、字級下限），改色票時會被擋下。
- 提示訊息（toast）停留 7 秒、錯誤 10 秒，可點一下關閉。
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
- Production bundle：首屏 JS 119.4 kB（gzip 47.7 kB）＋ CSS 12.8 kB；編輯器、排行榜、我的頁面分開延遲載入；不載入任何字型檔與圖示套件。
- 編輯器預覽解析度跟著實際顯示尺寸（最多 2 倍螢幕密度），拖曳時以 `requestAnimationFrame` 合併重繪，只有儲存時才繪製 1080 圖。
- 降級：`ResizeObserver` 不存在時改用 resize 事件；Web Share 不支援檔案時隱藏分享鈕；IndexedDB／localStorage 不可用時 mock 與草稿退回記憶體。
- 自己的照片先縮到 1080 × 1080 再畫，12MP 手機照片也不會在舊手機上吃光記憶體；上限 30 MB。
- 已測試：Playwright Chromium 模擬 iPhone SE、iPhone 13、Pixel（瀏覽器模擬，不代表實機）；假的 flutterObject 驗證 `userinfo`、`location`、`daily_reminder` 收送格式與自己的照片輸出。

## 9. 資料來源與示範資料

政策與作品目前是示範資料（mock 模式），背景照片是真實資料：

- 政策（`src/api/mock/fixtures.ts`）：9 筆有效、1 筆已過期（驗證日期過濾）。標語為測試文案，`sourceUrl` 暫時指向各主管機關首頁，上線前由政策內容人員替換為具體政策頁並驗證。
- 背景（`public/data/backgrounds.json`、`public/backgrounds/*.jpg`）：**真實照片**，10 張臺北地標，來自 Unsplash，依 [Unsplash License](https://unsplash.com/license) 可免費使用、修改與商用，不強制標示；編輯器仍標示「照片：攝影師／Unsplash」並連到原圖頁。圓山大飯店與國立故宮博物院設為儲存 3 張後解鎖。陽明山草原那張在 Unsplash 標示為臺北，但確切拍攝地點未驗證。
- 新增背景：照片放進 `public/backgrounds/`，在 `backgrounds.json` 加一筆（id 不重複，填攝影師與出處）。
- 徽章圖示：程式產生的示意 SVG；正式版由後端回傳 S3 presigned URL。
- 徽章大圖：`public/badges/lv1.webp`–`lv3.webp`（設計稿，1254 × 1254）；Lv.4 以上尚無設計稿，退回示意圖示。新增大圖：放進 `public/badges/`，在 `src/config/badges.ts` 的 `BADGE_ART_FILES` 加一行。「我的」頁面大圖放在個人資料卡右側、可點開放大；十級徽章清單每一列也可點開放大；獲得新徽章時由 `BadgeCelebration.vue` 顯示全螢幕慶祝畫面（徽章轉圈登場，需按「太棒了！」關閉；`prefers-reduced-motion` 時不播動畫）。畫面上有「分享給親友」（`composables/share.ts`：系統分享 → 複製連結 → 顯示文字讓人長按複製，連結見 `VITE_SHARE_URL`）與右上角「音效：開／關」（`composables/sound.ts`：Web Audio 現場合成約 3.5 秒的歡樂音效，無音檔；音高刻意避開太尖的高頻；iPhone 靜音開關打開時網頁聲音會被靜音；觸發慶祝的按鈕要在點擊當下呼叫 `unlockAudio()`）。
- 排行榜：單欄大卡片（`LeaderboardView.vue` 重用 `ArtworkCard` 的 `rank`、`score`、`large`），手機一欄、寬螢幕自動多欄；API 層（`getLeaderboard`）沒有改。
- 示範作品：首次開啟時用同一套編輯器自動產生 5 張，愛心與下載數為假資料。「我的 › 重設示範資料」可清空重來。
- 使用者自己的照片：只在手機端裁切成作品，不另外上傳原圖，也不會帶出相片 EXIF（拍攝地點等）；儲存後作品公開在作品牆，面板上會提醒。

## 10. 專案結構

```text
GoodMorning/
├─ public/data/backgrounds.json   背景圖庫（Unsplash 照片清單與攝影師）
├─ public/backgrounds/            背景照片
├─ src/
│  ├─ api/          types（對應 openapi）、http、mock、errors
│  ├─ components/   TopBar、TabBar、Segmented、BottomSheet、DownloadSheet、ArtworkCard…
│  ├─ composables/  bridge（TownPass：open_link、userinfo、location、daily_reminder）、toast、artworkActions
│  ├─ config/       badges（徽章、排行榜計分）
│  ├─ data/         backgrounds（讀取背景圖庫 JSON）
│  ├─ css/          tokens、base
│  ├─ editor/       layout（排版純函式）、render（canvas）、styles、scene、draft、qr、customPhoto、townpassLogo
│  ├─ router/
│  └─ views/        Feed、Editor、Artwork、Leaderboard、Me
├─ tests/
├─ Dockerfile、nginx.conf.template、docker/10-api-proxy.sh
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
