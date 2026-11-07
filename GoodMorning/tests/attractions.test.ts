import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { AttractionCatalog } from '../src/data/attractions'

const catalog = JSON.parse(readFileSync(new URL('../public/data/taipei-attractions.json', import.meta.url), 'utf8')) as AttractionCatalog
const SEASONAL = [269, 1541, 424, 1735, 375]

describe('臺北旅遊網背景 JSON', () => {
  it('有景點且 id 不重複', () => {
    const ids = catalog.attractions.map((a) => a.id)
    expect(ids.length).toBeGreaterThan(300)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('每個景點都有照片，網址格式一致', () => {
    for (const a of catalog.attractions) {
      expect(a.images.length).toBeGreaterThan(0)
      for (const img of a.images) expect(img.src).toBe(`https://www.travel.taipei/image/${img.id}`)
      expect(a.url).toBe(`https://www.travel.taipei/zh-tw/attraction/details/${a.id}`)
      expect(a.district).toMatch(/區$/)
    }
  })
  it('分類都列在 categories', () => {
    const cats = new Set(catalog.categories)
    for (const a of catalog.attractions) for (const c of a.categories) expect(cats.has(c)).toBe(true)
  })
  it('季節限定背景都存在', () => {
    const ids = new Set(catalog.attractions.map((a) => a.id))
    for (const id of SEASONAL) expect(ids.has(id)).toBe(true)
  })
})
