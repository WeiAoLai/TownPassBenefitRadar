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
