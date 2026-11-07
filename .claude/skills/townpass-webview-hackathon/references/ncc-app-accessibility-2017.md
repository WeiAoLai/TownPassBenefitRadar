# NCC mobile app accessibility development guideline (2017)

Source: 國家通訊傳播委員會（NCC），《行動版應用程式(APP)無障礙開發指引》，中華民國 106 年 11 月（PDF metadata: created 2017-12-20）. The original file is kept at [../assets/ncc-app-accessibility-guideline-2017.pdf](../assets/ncc-app-accessibility-guideline-2017.pdf).

## What this document is

- A Taiwanese government guideline for mobile web applications. It is mainly a localized adaptation of W3C **Mobile Web Application Best Practices (MWABP, 14 December 2010)** and its flipcards.
- It explicitly does **not** repeat 「網站無障礙規範 2.0 版」 (NCC, 2017-02-15); that document remains the general web accessibility baseline it builds on. Verify which version of the national web accessibility standard is current (and which agency now publishes it) before citing one in a deliverable.
- Structure: 6 basic considerations, 6 guidelines with 32 numbered items (1.1–6.6), and 3 advanced considerations.

## How to use it in TownPass work

- Treat it as **Taiwan-specific supporting evidence** for mobile and WebView decisions, and as a reviewer-friendly citation for judges or agencies. It does not override the TownPass 12-category accessibility guideline ([accessibility.md](accessibility.md)), the verified bridge contract ([webview-bridge.md](webview-bridge.md)), or current competition rules.
- Many techniques are dated (2010 W3C source). Apply the **intent** of each item with current web practice; never implement an obsolete mechanism just because the guideline names it. The table below states the current equivalent.
- When citing it in a README or demo, use the item number, e.g. 「NCC APP 無障礙開發指引 1.4」.

## Basic considerations (基本考量)

| Consideration | TownPass WebView application |
|---|---|
| 應用程式資料 | Separate app content from personalization (e.g. large-text mode). State where each lives and whether it leaves the device. |
| 安全和隱私 | Same risks as desktop web. Keep secrets out of the bundle; minimize personal data read through `userinfo` or `location`. |
| 使用者認知和控制 | Users must know and control access to location, contacts, media, call logs, and device context. Prefer the platform/host permission prompt; add in-page explanation where the host prompt is not enough. |
| 節省使用資源 | Minimize memory, CPU, and network. See [device-compatibility.md](device-compatibility.md). |
| 使用者經驗 | Account for latency, interaction method, and data consistency. |
| 處理傳輸情境差異 | Adapt content and navigation to detected capabilities rather than device names. |

## Item-by-item mapping

Status: **Apply** = use as written in spirit; **Adapt** = keep the intent, use the modern technique; **Superseded** = the named mechanism is obsolete; follow the replacement; **N/A** = handled by the TownPass host.

### 1. 讓使用者自由掌控 (Set Users Free)

| Item | Guideline | Status | TownPass WebView practice |
|---|---|---|---|
| 1.1 | Notify users before collecting personal or device information; explain use and whether it is sent to a server. If refused, return to the previous state and do not retry automatically. | Apply | Before calling `location` or `userinfo`, say why and whether data leaves the device. On refusal or empty reply, show the manual path; never loop the request. Matches TownPass NT/FM and the permission-denied state in SKILL.md. |
| 1.2 | Offer automatic login; never store unencrypted passwords; allow revocation. | N/A | Identity belongs to the TownPass host. Do not build a separate login inside the WebView unless the service truly needs its own account. |
| 1.3 | Provide user-selectable interface versions; auto-detection must not be the only mechanism; remember the choice. | Adapt | Any automatic mode (e.g. large-text or elder mode from `userinfo` age) must also have a visible manual switch. Remembering the choice is allowed only when the README states where it is stored; prefer in-memory or `localStorage` with no personal data. |
| 1.4 | Move focus only when necessary and not against the user's control. | Apply | Move focus to the new `h1` on route change and to errors on failed submit; never steal focus on background updates. Matches TownPass FC and DC. |

### 2. 最佳化反應時間 (Optimize response time)

| Item | Guideline | Status | TownPass WebView practice |
|---|---|---|---|
| 2.1 | Combine small decorative images into CSS sprites. | Superseded | Use inline SVG icons or an SVG symbol sprite. Keep meaningful images as real `img` with `alt`. |
| 2.2 | Embed background images in CSS as base64. | Adapt | Inline only tiny decorative assets; base64 adds about 10% after gzip and defeats caching. Let the bundler decide thresholds. |
| 2.3 | Keep the DOM reasonably small; paginate large data. | Apply | Paginate or virtualize long lists; avoid rendering every record of an open dataset at once. |
| 2.4 | Minimize perceived latency: incremental rendering, progress indicators, no full reloads, prefetch likely next views. | Apply | Use route-level code splitting, skeleton or progress states with `role="status"`, client-side routing, and prefetch only small, likely-needed chunks. |
| 2.5 | Optimize startup: offline technique (AppCache), split large scripts, local snapshot of last state, minimize storage reads at startup. | Adapt | AppCache is removed from browsers; use bundled data or a Service Worker only when offline support is in scope. Code-split rarely used features. Do not cache personal data without saying so. |

### 3. 利用行動特性 (Exploit mobile specific features)

| Item | Guideline | Status | TownPass WebView practice |
|---|---|---|---|
| 3.1 | Make phone numbers click-to-call with `tel:` using the full international number; check device support. | Adapt | Inside TownPass use the verified `phone_call` bridge method; in a browser fall back to `<a href="tel:+886-2-…">`. Show the number as visible text so users can dial manually when the host declines. Never claim the call happened. |
| 3.2 | Use push (OMA Push, SMS, QR codes) to reach users outside the app. | Superseded | OMA Push and UAProf are obsolete. Use only verified TownPass host capabilities (for example `notify`) after checking the host source; do not add a third-party push service without event approval. |
| 3.3 | Use `<meta name="viewport" content="width=device-width, initial-scale=1.0">`. | Apply | Use exactly this baseline (adding `viewport-fit=cover` is fine). **Never** add `maximum-scale=1` or `user-scalable=no`; TownPass DT requires pinch zoom and 200% text. |
| 3.4 | Prefer client-side storage APIs over cookies for local data. | Adapt | Use `localStorage`/IndexedDB only for non-sensitive data, wrapped in `try/catch`; WebView storage can be cleared or unavailable. Record storage use in the README privacy section. |

### 4. 減少使用網路 (Spare the Network)

| Item | Guideline | Status | TownPass WebView practice |
|---|---|---|---|
| 4.1 | Serve compressed responses (gzip/DEFLATE); little gain for JPEG, media, or files under 1 KB. | Apply | Enable gzip or Brotli on the static host; compress SVG, JS, CSS, JSON. |
| 4.2 | Use content-fingerprinted URLs with far-future expiry. | Apply | Vite/Webpack hashed asset names already do this; set long `Cache-Control` for hashed assets and no-cache for `index.html`. |
| 4.3 | Cache AJAX data like main content. | Apply | Use `ETag`/`Cache-Control` on public data APIs; never cache responses containing personal data in shared caches. |
| 4.4 | Minimize external resources; combine stylesheets and scripts. | Adapt | With HTTP/2 the goal is fewer critical-path requests, not one giant file. Avoid third-party fonts, analytics, and CDNs on the critical path. |
| 4.5 | Minify HTML, JS, and CSS. | Apply | Production build must minify; report bundle size in the README. |
| 4.6 | Avoid redirects; if more than two are needed, show an interstitial. | Apply | Register the final HTTPS URL as `destinationUrl`; avoid redirect chains inside the WebView. |
| 4.7 | Batch requests, throttle low-priority requests, pause polling when idle, adapt to connection type. | Apply | No background polling unless the feature needs it; pause on `visibilitychange`; batch API calls per screen. |
| 4.8 | Use cookies sparingly; keep working when cookies are unavailable. | Apply | The core flow must work with storage and cookies disabled. |
| 4.9 | Do not send unnecessary cookies (serve static assets from a cookie-less path or domain). | Apply | Scope cookies by path; static assets should not receive app cookies. |

### 5. 牢記網頁原則 (Remember Web Principles)

| Item | Guideline | Status | TownPass WebView practice |
|---|---|---|---|
| 5.1 | Replicate local data to the server when it must be shared across devices; fail gracefully on unreliable connectivity. | Adapt | Only replicate data the user expects to sync and the privacy notice covers. `navigator.onLine` is not proof of connectivity; handle request failure with retry and a clear error state. Services that promise "data never leaves the phone" must not replicate at all. |
| 5.2 | Keep state consistent across devices. | Adapt | Applies only to services with their own accounts and server state; most TownPass microservices are stateless or rely on the host identity. |
| 5.3 | Never run unescaped or untrusted JSON with `eval()`; use a JSON parser. | Apply | Always `JSON.parse` bridge messages and API responses inside `try/catch`, and validate fields before use. This is also required by [webview-bridge.md](webview-bridge.md). |
| 5.4 | Use fragment identifiers so pages have deep links and the Back button works. | Adapt | Use the router's history mode (or hash mode if the host requires) so every view has its own URL, Back works, and state survives reload where appropriate. Handle hidden/shown content with correct ARIA. |

### 6. 彈性設計 (Design for Flexibility)

| Item | Guideline | Status | TownPass WebView practice |
|---|---|---|---|
| 6.1 | Support focus-based, pointer-based, and touch-based interaction. Focus must be visible; touch targets need wide spacing and at least about 1 cm height; do not rely on hover. | Apply | TownPass sets the stricter concrete target: at least 48 × 48 CSS px. Visible focus, no hover-only information, keyboard reachable carousels with controls. |
| 6.2 | Text must reflow without horizontal scrolling, including on orientation change; use relative units. | Apply | Use `rem`/`%`/`fr`, avoid fixed heights; verify 200% text and landscape. |
| 6.3 | Detect capabilities on the server from HTTP headers (Accept, User-Agent, X-Wap-Profile). | Superseded | UA sniffing and X-Wap-Profile are unreliable. Do not branch features on User-Agent; use client feature detection. |
| 6.4 | Detect capabilities on the client: JavaScript feature detection, CSS media types, CSS media queries. | Apply | `if ('geolocation' in navigator)`, `@supports`, and media queries (`prefers-reduced-motion`, width, orientation). |
| 6.5 | Group target devices into capability classes and build one variant per class, not per device. | Adapt | Define the support baseline in the README (e.g. iOS 15 WebView, low-end Android) and build one progressively enhanced app, not device-specific forks. |
| 6.6 | Provide a non-JavaScript variant where reach matters; otherwise use `<noscript>` to explain. | Adapt | A TownPass WebView always runs JavaScript, so a full no-JS variant is unnecessary; still include a `<noscript>` message for direct browser access. |

## Advanced considerations (行動網頁進階考慮)

| Topic | Guideline | TownPass WebView practice |
|---|---|---|
| Canvas or SVG graphics | SVG suits scalable, modifiable graphics; Canvas suits fast bitmaps but is not accessible on its own and must not be the only way information is conveyed. | Charts and diagrams need a text or table alternative. Prefer SVG with `role="img"` and an accessible name. |
| Notify users about automatic network access | Network activity costs battery and money; disclose frequency, duration, and expected data use. | Disclose background requests in the README and, if any run during use, in the UI. |
| Let users control automatic network access | Provide a way to disable automatic network activity and adjust polling. | Any auto-refresh or polling needs a visible pause or off control (also TownPass DC). |

## Review checklist derived from this guideline

Use alongside the TownPass 12 categories during acceptance:

- [ ] 1.1 Every device or personal-data request is explained first, and refusal leads to a usable manual path without repeated prompts.
- [ ] 1.3 Every automatic interface mode has a visible manual override.
- [ ] 1.4 Focus moves only on route change, submit errors, or explicit user action.
- [ ] 2.4 Loading states are visible and announced; no full-page reloads within the flow.
- [ ] 3.1 Phone numbers are visible text and callable through `phone_call` or `tel:`.
- [ ] 3.3 Viewport meta allows zoom (no `maximum-scale` or `user-scalable=no`).
- [ ] 4.x Production assets are minified, compressed, fingerprinted, and free of unnecessary third-party requests; no idle polling.
- [ ] 5.3 No `eval()`; all external JSON is parsed and validated.
- [ ] 5.4 Each view has its own URL and the Back button behaves predictably.
- [ ] 6.1 / 6.2 Targets ≥ 48 × 48, visible focus, no hover-only content, reflow at 200% text and in landscape.
- [ ] 6.4 Capabilities are feature-detected, not inferred from User-Agent.
- [ ] Advanced: charts have text alternatives; automatic network activity is disclosed and controllable.
