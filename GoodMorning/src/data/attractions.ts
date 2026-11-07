/**
 * 長輩圖背景圖庫：臺北旅遊網景點（public/data/taipei-attractions.json）。
 * 由 scripts/fetch-attractions.mjs 從 Open API 產生，前端執行時直接讀這份 JSON。
 *
 * travel.taipei 的圖片沒有 CORS header，直接載入會讓 canvas 無法輸出 PNG，
 * 所以一律經由同網域代理 `travel-img/{id}` 取得（vite dev 與 nginx 都已設定）。
 */
export interface AttractionImage {
  id: number
  src: string
}

export interface Attraction {
  id: number
  name: string
  district: string
  categories: string[]
  images: AttractionImage[]
  url: string
  modified: string
}

export interface AttractionCatalog {
  source: { name: string; api: string; site: string; license: string; fetchedAt: string; filter: string }
  categories: string[]
  attractions: Attraction[]
}

/** 圖片代理位置；可用 VITE_TRAVEL_IMAGE_BASE 覆寫（例如後端搬到 S3 之後） */
export const IMAGE_BASE = import.meta.env.VITE_TRAVEL_IMAGE_BASE || 'travel-img/'

export const imageUrl = (imageId: number) => new URL(`${IMAGE_BASE}${imageId}`, document.baseURI).href

/** 累積儲存 3 張作品後解鎖的「季節限定」背景（US-05 指定背景） */
export const UNLOCK_THRESHOLD = 3
export const SEASONAL_IDS = new Set([269, 1541, 424, 1735, 375])
export const SEASONAL_LABEL = '季節限定'

export const unlockThresholdOf = (id: number) => (SEASONAL_IDS.has(id) ? UNLOCK_THRESHOLD : 0)

/** 顯示用名稱：底線改成間隔號 */
export const displayName = (name: string) => name.trim().replace(/_/g, '・')

let catalog: Promise<AttractionCatalog> | null = null

export function loadAttractions(): Promise<AttractionCatalog> {
  if (!catalog) {
    catalog = fetch(new URL('data/taipei-attractions.json', document.baseURI).href)
      .then((r) => {
        if (!r.ok) throw new Error(`景點資料載入失敗（HTTP ${r.status}）`)
        return r.json() as Promise<AttractionCatalog>
      })
      .catch((e) => {
        catalog = null
        throw e
      })
  }
  return catalog
}
