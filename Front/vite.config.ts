/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 相對路徑：打包後放在任何網址底下都能開
  base: './',
  build: {
    // 台北通 iOS 最低支援 15.0（taipei-doit/TownPass 的 IPHONEOS_DEPLOYMENT_TARGET）。
    // 不設定的話，新版 Vite 預設目標比 iOS 15 新，舊 iPhone 會白畫面。
    target: ['es2020', 'safari15', 'chrome87'],
    cssTarget: ['safari15', 'chrome87'],
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
