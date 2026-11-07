/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 相對路徑：打包後放在任何網址底下都能開
  base: './',
  server: {
    proxy: {
      // 臺北旅遊網景點照片沒有 CORS header，經同網域代理才能畫進 canvas 並輸出 PNG
      '/travel-img': {
        target: 'https://www.travel.taipei',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/travel-img/, '/image'),
      },
      // 串接真後端時：VITE_API_MODE=http，並把 /api 代理到後端
      ...(process.env.API_PROXY_TARGET
        ? { '/api': { target: process.env.API_PROXY_TARGET, changeOrigin: true } }
        : {}),
    },
  },
  preview: {
    proxy: {
      '/travel-img': {
        target: 'https://www.travel.taipei',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/travel-img/, '/image'),
      },
    },
  },
  build: {
    // 台北通 iOS 最低支援 15.0（taipei-doit/TownPass IPHONEOS_DEPLOYMENT_TARGET）
    target: ['es2020', 'safari15', 'chrome87'],
    cssTarget: ['safari15', 'chrome87'],
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
