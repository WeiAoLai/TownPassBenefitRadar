import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { BackgroundCatalog } from '../src/data/backgrounds'

const catalog = JSON.parse(readFileSync(new URL('../public/data/backgrounds.json', import.meta.url), 'utf8')) as BackgroundCatalog

describe('背景圖庫 JSON', () => {
  it('id 不重複、檔名唯一', () => {
    const ids = catalog.backgrounds.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(catalog.backgrounds.map((b) => b.file)).size).toBe(ids.length)
  })
  it('每張都有攝影師與 Unsplash 出處', () => {
    for (const b of catalog.backgrounds) {
      expect(b.author.length).toBeGreaterThan(0)
      expect(b.photoUrl).toMatch(/^https:\/\/unsplash\.com\/photos\//)
      expect(b.file).toMatch(/^[a-z0-9-]+\.jpg$/)
    }
  })
  it('至少有一張一開始就能用，且有解鎖背景（US-05）', () => {
    expect(catalog.backgrounds.some((b) => b.unlockThreshold === 0)).toBe(true)
    expect(catalog.backgrounds.some((b) => b.unlockThreshold === 3)).toBe(true)
  })
})
