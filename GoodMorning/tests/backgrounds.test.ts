import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { catalogBackgrounds, serverBackgroundId, type BackgroundCatalog } from '../src/data/backgrounds'

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


describe('背景解鎖由前端圖庫判斷（依使用者作品數）', () => {
  vi.stubGlobal('document', { baseURI: 'http://localhost/' })
  const items = [
    { id: 1, name: '台北101夕照', district: '信義區', file: 'a.jpg', unlockThreshold: 0, author: 'x', photoUrl: 'https://x', lat: 25, lng: 121 },
    { id: 9, name: '圓山大飯店', district: '中山區', file: 'b.jpg', unlockThreshold: 3, author: 'y', photoUrl: 'https://y', lat: 25, lng: 121 },
  ]

  it('每個使用者依自己的作品數解鎖', () => {
    expect(catalogBackgrounds(items, 0).map((b) => b.unlocked)).toEqual([true, false])
    expect(catalogBackgrounds(items, 3).map((b) => b.unlocked)).toEqual([true, true])
    expect(catalogBackgrounds(items, 0)[0].imageUrl).toBe('http://localhost/backgrounds/a.jpg')
  })

  it('送給後端的 backgroundId：同名優先，否則用後端第一張已解鎖的', () => {
    const server = [
      { id: 1, name: '台北晨曦', imageUrl: '', unlockThreshold: 0, unlocked: true },
      { id: 4, name: '艋舺龍山寺', imageUrl: '', unlockThreshold: 0, unlocked: true },
      { id: 11, name: '國立故宮博物院', imageUrl: '', unlockThreshold: 3, unlocked: false },
    ]
    expect(serverBackgroundId('艋舺龍山寺', server)).toBe(4)
    expect(serverBackgroundId('圓山大飯店', server)).toBe(1)
    expect(serverBackgroundId('國立故宮博物院', server)).toBe(1)
    expect(serverBackgroundId('西門町', [])).toBeNull()
  })
})
