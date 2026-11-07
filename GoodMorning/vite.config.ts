/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

/**
 * 開發用：把背景照片寫進 public/backgrounds/{name}.jpg（只在 npm run dev 時存在，不進 production build）。
 * 用來把 Unsplash 下載的照片放進專案，讓照片與前端同網域，canvas 才能輸出 PNG。
 */
function backgroundImport(): Plugin {
  const dir = fileURLToPath(new URL('./public/backgrounds/', import.meta.url))
  return {
    name: 'background-import',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__bg', (req, res) => {
        const name = (req.url ?? '').replace(/^\//, '')
        if (req.method !== 'POST' || !/^[a-z0-9-]{1,60}$/.test(name)) {
          res.statusCode = 400
          return res.end('bad request')
        }
        const chunks: Buffer[] = []
        let size = 0
        req.on('data', (c: Buffer) => {
          size += c.length
          if (size <= 5 * 1024 * 1024) chunks.push(c)
        })
        req.on('end', () => {
          const body = Buffer.concat(chunks)
          if (size > 5 * 1024 * 1024 || body[0] !== 0xff || body[1] !== 0xd8) {
            res.statusCode = 415
            return res.end('jpeg only')
          }
          mkdirSync(dir, { recursive: true })
          writeFileSync(`${dir}${name}.jpg`, body)
          res.end('ok')
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), backgroundImport()],
  // 相對路徑：打包後放在任何網址底下都能開
  base: './',
  server: {
    // 串接真後端時：VITE_API_MODE=http，並把 /api 代理到後端
    proxy: process.env.API_PROXY_TARGET
      ? { '/api': { target: process.env.API_PROXY_TARGET, changeOrigin: true } }
      : undefined,
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
