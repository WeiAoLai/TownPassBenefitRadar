import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end 測試（npm run test:e2e）。
 * - mock：正式 build＋示範資料模式，不需要後端；在 iPhone 13 與 Pixel 7 兩種尺寸各跑一次。
 * - http：串接模式，瀏覽器的 /api/v1 請求由測試攔截回應（tests 內的假後端），驗證請求路徑與 X-Demo-User。
 * 第一次執行前：npx playwright install chromium
 */
const MOCK_PORT = 4319
const HTTP_PORT = 4320

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    trace: 'retain-on-failure',
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
  },
  projects: [
    {
      name: 'mock-iphone13',
      testIgnore: /http\.spec\.ts/,
      use: { ...devices['iPhone 13'], browserName: 'chromium', baseURL: `http://localhost:${MOCK_PORT}` },
    },
    {
      name: 'mock-pixel7',
      testIgnore: /http\.spec\.ts/,
      use: { ...devices['Pixel 7'], baseURL: `http://localhost:${MOCK_PORT}` },
    },
    {
      name: 'http-iphone13',
      testMatch: /http\.spec\.ts/,
      use: { ...devices['iPhone 13'], browserName: 'chromium', baseURL: `http://localhost:${HTTP_PORT}` },
    },
  ],
  webServer: [
    {
      command: `npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port ${MOCK_PORT} --strictPort`,
      port: MOCK_PORT,
      reuseExistingServer: !process.env.CI,
      env: { VITE_API_MODE: 'mock' },
      timeout: 120_000,
    },
    {
      command: `npx vite build --outDir dist-e2e-http --emptyOutDir && npx vite preview --outDir dist-e2e-http --port ${HTTP_PORT} --strictPort`,
      port: HTTP_PORT,
      reuseExistingServer: !process.env.CI,
      env: { VITE_API_MODE: 'http', VITE_API_BASE_URL: '/api/v1' },
      timeout: 120_000,
    },
  ],
})
