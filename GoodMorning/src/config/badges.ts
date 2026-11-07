/** 十級徽章（需求文件 US-07 草案：第 n 級門檻 = 2^(n-1) 張） */
export const BADGES = [
  { level: 1, name: '初心傳聲', threshold: 1 },
  { level: 2, name: '雙喜分享', threshold: 2 },
  { level: 3, name: '四方送暖', threshold: 4 },
  { level: 4, name: '八方傳福', threshold: 8 },
  { level: 5, name: '鄰里好手', threshold: 16 },
  { level: 6, name: '社區達人', threshold: 32 },
  { level: 7, name: '城市傳聲', threshold: 64 },
  { level: 8, name: '政策推手', threshold: 128 },
  { level: 9, name: '全民分享家', threshold: 256 },
  { level: 10, name: '長輩圖典藏家', threshold: 512 },
] as const

export type BadgeDef = (typeof BADGES)[number]

export function badgeFor(count: number): BadgeDef | null {
  let hit: BadgeDef | null = null
  for (const b of BADGES) if (count >= b.threshold) hit = b
  return hit
}

export function nextBadge(count: number): BadgeDef | null {
  return BADGES.find((b) => count < b.threshold) ?? null
}

/** 徽章底色：依等級由青綠漸進到金色，對應 TownPass primary → secondary */
const TIERS = ['#93D4DF', '#71C5D5', '#5AB4C5', '#468D9B', '#356C77', '#F4D69E', '#F0C87C', '#F5BA4B', '#E7A43C', '#AD7B2B']

/** 示範用徽章圖示（正式版由內容人員 B 提供並放 S3） */
export function badgeIconDataUrl(level: number): string {
  const c = TIERS[Math.min(Math.max(level, 1), 10) - 1]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M20 2h10l-6 22h-10z" fill="#D45251"/><path d="M44 2h-10l6 22h10z" fill="#D45251"/><circle cx="32" cy="38" r="22" fill="${c}" stroke="#fff" stroke-width="3"/><circle cx="32" cy="38" r="16" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.5"/><text x="32" y="45" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="20" fill="#fff">${level}</text></svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

/**
 * 徽章大圖（public/badges/）。目前只有 Lv.1–3 有設計稿；沒有大圖的等級先退回上面的示意圖示。
 * 新增大圖：把圖片放進 public/badges/，在這裡加一行 { 等級: '檔名' }，畫面不用改。
 */
export const BADGE_ART_FILES: Readonly<Record<number, string>> = {
  1: 'lv1.webp',
  2: 'lv2.webp',
  3: 'lv3.webp',
}

export function badgeArtUrl(level: number): string {
  const file = BADGE_ART_FILES[level]
  return file ? new URL(`badges/${file}`, document.baseURI).href : badgeIconDataUrl(level)
}

/** 作品排行榜分數（US-06）：max(愛心數, 下載數) */
export const leaderboardScore = (a: { likeCount: number; downloadCount: number }) => Math.max(a.likeCount, a.downloadCount)

/**
 * Competition ranking（1、2、2、4）。同分顯示順序依建立時間由新到舊（openapi /leaderboard）。
 */
export function rankArtworks<T extends { likeCount: number; downloadCount: number; createdAt: string }>(
  items: T[],
  limit = 100,
): { rank: number; score: number; artwork: T }[] {
  const sorted = [...items].sort((a, b) => {
    const d = leaderboardScore(b) - leaderboardScore(a)
    return d !== 0 ? d : b.createdAt.localeCompare(a.createdAt)
  })
  const out: { rank: number; score: number; artwork: T }[] = []
  sorted.forEach((artwork, i) => {
    const score = leaderboardScore(artwork)
    const rank = i > 0 && out[i - 1].score === score ? out[i - 1].rank : i + 1
    out.push({ rank, score, artwork })
  })
  return out.slice(0, limit)
}
