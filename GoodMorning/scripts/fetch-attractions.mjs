#!/usr/bin/env node
/**
 * 從臺北旅遊網 Open API 抓取全部景點，整理成長輩圖背景用的 JSON。
 *   node scripts/fetch-attractions.mjs
 * 輸出：public/data/taipei-attractions.json
 *
 * 規則：只保留地址在臺北市、且至少有一張照片的景點；每個景點保留前 3 張照片。
 * API 需要 `accept: application/json` header，否則回 400。
 */
import { writeFile } from 'node:fs/promises'

const API = 'https://www.travel.taipei/open-api/zh-tw/Attractions/All'
const OUT = new URL('../public/data/taipei-attractions.json', import.meta.url)

const all = []
for (let page = 1; page < 100; page++) {
  const res = await fetch(`${API}?page=${page}`, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`page ${page}: HTTP ${res.status}`)
  const json = await res.json()
  if (!json.data?.length) break
  all.push(...json.data)
  process.stdout.write(`\rpage ${page}  ${all.length}/${json.total}`)
  if (all.length >= json.total) break
}
process.stdout.write('\n')

export function toCatalog(rows, fetchedAt) {
  const inTaipei = rows.filter((x) => /^(臺|台)北市/.test(String(x.address ?? '').replace(/^\d+\s*/, '')) && x.images?.length)
  const categories = [...new Set(inTaipei.flatMap((x) => x.category.map((c) => c.name)))]
  return {
    source: {
      name: '臺北旅遊網 Open API：景點（Attractions/All，zh-tw）',
      api: API,
      site: 'https://www.travel.taipei/',
      license: '依臺北旅遊網／臺北市政府資料開放平台（https://data.taipei）規定；照片使用授權上線前需由內容人員確認',
      fetchedAt,
      filter: '地址位於臺北市且至少一張照片；每景點保留前 3 張照片',
    },
    categories,
    attractions: inTaipei.map((x) => ({
      id: x.id,
      name: x.name,
      district: x.distric,
      categories: x.category.map((c) => c.name),
      images: x.images.slice(0, 3).map((i) => ({ id: Number(i.src.split('/').pop()), src: i.src })),
      url: x.url,
      modified: String(x.modified).slice(0, 10),
    })),
  }
}

const catalog = toCatalog(all, new Date().toISOString().slice(0, 10))
await writeFile(OUT, JSON.stringify(catalog, null, 1) + '\n')
console.log(`wrote ${catalog.attractions.length} attractions → ${OUT.pathname}`)
