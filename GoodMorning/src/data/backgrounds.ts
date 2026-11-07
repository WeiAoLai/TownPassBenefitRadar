import type { Background } from '../api/types'

/**
 * 長輩圖背景圖庫：public/data/backgrounds.json，照片放在 public/backgrounds/。
 * 照片來自 Unsplash（Unsplash License：免費、可修改），與前端同網域，canvas 可以直接輸出 PNG。
 * 新增背景：照片放進 public/backgrounds/，在 JSON 加一筆（id 不可重複），並填攝影師與出處。
 */
export interface BackgroundItem {
  id: number
  name: string
  district: string
  file: string
  /** 累積儲存幾張作品後解鎖；0 = 一開始就能用（US-05） */
  unlockThreshold: number
  author: string
  photoUrl: string
  /** 地標約略位置，只用於「離我最近」排序 */
  lat: number
  lng: number
}

export interface BackgroundCatalog {
  source: string
  license: string
  licenseUrl: string
  fetchedAt: string
  backgrounds: BackgroundItem[]
}

export const backgroundUrl = (file: string) => new URL(`backgrounds/${file}`, document.baseURI).href

let catalog: Promise<BackgroundCatalog> | null = null

export function loadBackgroundCatalog(): Promise<BackgroundCatalog> {
  if (!catalog) {
    catalog = fetch(new URL('data/backgrounds.json', document.baseURI).href)
      .then((r) => {
        if (!r.ok) throw new Error(`背景資料載入失敗（HTTP ${r.status}）`)
        return r.json() as Promise<BackgroundCatalog>
      })
      .catch((e) => {
        catalog = null
        throw e
      })
  }
  return catalog
}

/**
 * 背景要顯示、要畫進畫布的圖片網址。
 * 名稱對得到前端圖庫的背景，一律用前端打包的照片（同網域：不需 S3 CORS、canvas 可以輸出、後端 S3 沒放照片也看得到）；
 * 對不到的才用後端回傳的 imageUrl（S3 presigned URL）。
 */
export function backgroundSrc(bg: { name: string; imageUrl: string }, catalog: readonly BackgroundItem[]): string {
  const item = catalog.find((c) => c.name === bg.name)
  return item ? backgroundUrl(item.file) : bg.imageUrl
}

/**
 * 畫面上的背景清單由前端圖庫決定（照片、地點、解鎖門檻都在 backgrounds.json）。
 * 解鎖看「目前這位使用者」的累積作品數（後端 GET /me 的 artworkCount），每個人各自計算。
 */
export function catalogBackgrounds(catalog: readonly BackgroundItem[], artworkCount: number): Background[] {
  return catalog.map((c) => ({
    id: c.id,
    name: c.name,
    imageUrl: backgroundUrl(c.file),
    unlockThreshold: c.unlockThreshold,
    unlocked: artworkCount >= c.unlockThreshold,
  }))
}

/**
 * 儲存作品時要送給後端的 backgroundId（openapi 必填，且必須是後端存在、已解鎖的背景）：
 * 後端有同名背景就用它的 id；沒有就用後端第一張已解鎖的背景，只當紀錄（作品圖本身已含前端的照片）。
 */
export function serverBackgroundId(name: string | undefined, server: readonly Background[]): number | null {
  const same = name ? server.find((b) => b.name === name && b.unlocked) : undefined
  return (same ?? server.find((b) => b.unlocked))?.id ?? null
}
