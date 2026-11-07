/**
 * 瀏覽器內的 mock 後端：完整模擬 openapi.yaml 的行為與錯誤碼，讓前端在後端完成前可以 demo。
 * 所有資料都是示範資料（見 fixtures.ts），畫面上會顯示「示範資料」標示。
 */
import { badgeFor, badgeIconDataUrl, rankArtworks } from '../../config/badges'
import { DAILY_ARTWORK_LIMIT, DAILY_LIMIT_CODE, countToday } from '../../config/limits'
import { defaultLayers } from '../../editor/scene'
import { createCanvas, exportPng, loadImage, renderScene } from '../../editor/render'
import { composeWithQr } from '../../editor/qr'
import { ApiError } from '../errors'
import type { Api, Artwork, ArtworkPage, Background, Badge, CurrentUser, Policy } from '../types'
import { backgroundUrl, loadBackgroundCatalog } from '../../data/backgrounds'
import { MOCK_POLICIES, MOCK_SEED_ARTWORKS, MOCK_USERS } from './fixtures'
import { kvClear, kvGet, kvSet } from './store'

interface ArtworkRow {
  id: number
  ownerId: number
  backgroundId: number
  policyId: number
  sloganText: string
  likeCount: number
  downloadCount: number
  createdAt: string
}

interface State {
  version: number
  nextId: number
  artworks: ArtworkRow[]
  /** `${userId}:${artworkId}` */
  likes: string[]
  /** 從台北通帳號建立的使用者（只存帳號與公開暱稱） */
  users?: UserRow[]
}

interface UserRow {
  id: number
  account: string
  displayName: string
  createdAt: string
}

const allUsers = (s: State): UserRow[] => [...MOCK_USERS, ...(s.users ?? [])]

const STATE_VERSION = 6
const MAX_BYTES = 10 * 1024 * 1024
/** 作品圖遺失時的佔位圖 */
const PLACEHOLDER =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#cad1d5"/></svg>')

/** 背景 = public/data/backgrounds.json（Unsplash 照片，放在 public/backgrounds/） */
async function backgroundRows() {
  const { backgrounds } = await loadBackgroundCatalog()
  return backgrounds.map((b) => ({
    id: b.id,
    name: b.name,
    imageUrl: backgroundUrl(b.file),
    unlockThreshold: b.unlockThreshold,
  }))
}

let state: State | null = null
let ready: Promise<State> | null = null
const urlCache = new Map<number, string>()

const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms))
let traceSeq = 0
const fail = (status: number, code: string, detail: string) =>
  new ApiError(status, code, detail, { traceId: `mock-${Date.now().toString(36)}-${++traceSeq}` })

function taipeiToday(): string {
  // en-CA 格式為 YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date())
}

function activePolicies() {
  const today = taipeiToday()
  return MOCK_POLICIES.filter((p) => p.isActive && p.startDate <= today && today <= p.endDate)
}

const toPolicy = ({ isActive: _i, ...p }: (typeof MOCK_POLICIES)[number]): Policy => p

async function persist() {
  if (state) await kvSet('state', state)
}

async function seed(): Promise<State> {
  const s: State = { version: STATE_VERSION, nextId: 1, artworks: [], likes: [] }
  const now = Date.now()
  for (const seedArt of MOCK_SEED_ARTWORKS) {
    const bg = (await backgroundRows()).find((b) => b.id === seedArt.backgroundId)
    const policy = MOCK_POLICIES.find((p) => p.id === seedArt.policyId)!
    const id = s.nextId++
    try {
      // 照片載入失敗（離線、代理未設定）時改用預設天空背景，示範作品仍可產生
      const img = bg ? await loadImage(bg.imageUrl).catch(() => null) : null
      const layers = defaultLayers(seedArt.greeting, policy.slogan, seedArt.greetingStyle, seedArt.sloganStyle)
      const blob = await exportPng({ background: img, layers }).catch(() => exportPng({ background: null, layers }))
      await kvSet(`img:${id}`, blob)
    } catch {
      /* 圖產生失敗時仍保留資料列，畫面會顯示預設圖 */
    }
    s.artworks.push({
      id,
      ownerId: seedArt.ownerId,
      backgroundId: seedArt.backgroundId,
      policyId: seedArt.policyId,
      sloganText: policy.slogan,
      likeCount: seedArt.likes,
      downloadCount: seedArt.downloads,
      createdAt: new Date(now - seedArt.ago * 3600_000).toISOString(),
    })
  }
  return s
}

function load(): Promise<State> {
  if (!ready) {
    ready = (async () => {
      const saved = await kvGet<State>('state')
      state = saved && saved.version === STATE_VERSION ? saved : await seed()
      await persist()
      return state
    })()
  }
  return ready
}

export async function resetMock() {
  urlCache.forEach((u) => URL.revokeObjectURL(u))
  urlCache.clear()
  await kvClear()
  state = null
  ready = null
  await load()
}

function badgeDto(count: number): Badge | null {
  const b = badgeFor(count)
  return b ? { level: b.level, name: b.name, iconUrl: badgeIconDataUrl(b.level) } : null
}

export function createMockApi(
  getUser: () => string,
  getProfile: () => { account: string; displayName: string } | null = () => null,
): Api {
  async function me() {
    const s = await load()
    await delay()
    const account = getUser()
    let u = allUsers(s).find((x) => x.account === account)
    // 台北通帳號第一次進來：建立使用者（只存帳號與公開暱稱）
    const profile = getProfile()
    if (!u && profile && profile.account === account) {
      u = { id: 1000 + (s.users?.length ?? 0), account, displayName: profile.displayName, createdAt: new Date().toISOString() }
      s.users = [...(s.users ?? []), u]
      await persist()
    }
    if (!u) throw fail(401, 'UNAUTHORIZED', '缺少或無效的 X-Demo-User')
    return { s, u }
  }

  const countOf = (s: State, userId: number) => s.artworks.filter((a) => a.ownerId === userId).length

  async function imageUrl(id: number): Promise<string> {
    const hit = urlCache.get(id)
    if (hit) return hit
    const blob = await kvGet<Blob>(`img:${id}`)
    if (!blob) return PLACEHOLDER
    const url = URL.createObjectURL(blob)
    urlCache.set(id, url)
    return url
  }

  async function toDto(s: State, row: ArtworkRow, viewerId: number): Promise<Artwork> {
    const owner = allUsers(s).find((u) => u.id === row.ownerId)!
    return {
      id: row.id,
      owner: { id: owner.id, displayName: owner.displayName, badge: badgeDto(countOf(s, owner.id)) },
      backgroundId: row.backgroundId,
      policyId: row.policyId,
      sloganText: row.sloganText,
      imageUrl: await imageUrl(row.id),
      likeCount: row.likeCount,
      downloadCount: row.downloadCount,
      likedByMe: s.likes.includes(`${viewerId}:${row.id}`),
      ownedByMe: row.ownerId === viewerId,
      createdAt: row.createdAt,
    }
  }

  async function page(s: State, rows: ArtworkRow[], viewerId: number, p = 0, size = 20): Promise<ArtworkPage> {
    if (!Number.isInteger(p) || p < 0 || !Number.isInteger(size) || size < 1 || size > 100)
      throw fail(400, 'PAGINATION_INVALID', 'page 或 size 不合法')
    const sorted = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const slice = sorted.slice(p * size, p * size + size)
    return {
      content: await Promise.all(slice.map((r) => toDto(s, r, viewerId))),
      page: p,
      size,
      totalElements: sorted.length,
      totalPages: Math.ceil(sorted.length / size),
    }
  }

  function find(s: State, id: number) {
    const row = s.artworks.find((a) => a.id === id)
    if (!row) throw fail(404, 'ARTWORK_NOT_FOUND', '作品不存在')
    return row
  }

  return {
    async getCurrentUser(): Promise<CurrentUser> {
      const { s, u } = await me()
      const artworkCount = countOf(s, u.id)
      return { ...u, artworkCount, badge: badgeDto(artworkCount) }
    },

    async listMyArtworks(p, size) {
      const { s, u } = await me()
      return page(s, s.artworks.filter((a) => a.ownerId === u.id), u.id, p, size)
    },

    async listBackgrounds(): Promise<Background[]> {
      const { s, u } = await me()
      const n = countOf(s, u.id)
      return (await backgroundRows()).map((b) => ({ ...b, unlocked: n >= b.unlockThreshold }))
    },

    async listPolicyCategories() {
      await me()
      return [...new Set(activePolicies().map((p) => p.category))]
    },

    async listPolicies(category) {
      await me()
      if (!category || category.length > 100) throw fail(400, 'CATEGORY_INVALID', 'category 不合法')
      return activePolicies().filter((p) => p.category === category).map(toPolicy)
    },

    async getRandomPolicy() {
      await me()
      const list = activePolicies()
      if (!list.length) throw fail(404, 'POLICY_NOT_FOUND', '目前沒有可選的政策')
      return toPolicy(list[Math.floor(Math.random() * list.length)])
    },

    async listArtworks(p, size) {
      const { s, u } = await me()
      return page(s, s.artworks, u.id, p, size)
    },

    async createArtwork(input) {
      const { s, u } = await me()
      if (input.image.size > MAX_BYTES) throw fail(413, 'ARTWORK_IMAGE_TOO_LARGE', '圖片超過 10 MB')
      if (input.image.type !== 'image/png') throw fail(400, 'ARTWORK_IMAGE_INVALID', '圖片必須是 PNG')
      const text = input.sloganText.trim()
      if (!text || input.sloganText.length > 500) throw fail(400, 'SLOGAN_INVALID', 'sloganText 長度需為 1–500')
      const bg = (await backgroundRows()).find((b) => b.id === input.backgroundId)
      if (!bg) throw fail(404, 'BACKGROUND_NOT_FOUND', '背景不存在')
      if (countOf(s, u.id) < bg.unlockThreshold) throw fail(403, 'BACKGROUND_LOCKED', '背景尚未解鎖')
      if (!activePolicies().some((p) => p.id === input.policyId)) throw fail(404, 'POLICY_NOT_FOUND', '政策不存在或已結束')
      // 每人每天最多 DAILY_ARTWORK_LIMIT 張（台北時間）
      const mine = s.artworks.filter((a) => a.ownerId === u.id).map((a) => a.createdAt)
      if (countToday(mine) >= DAILY_ARTWORK_LIMIT) {
        throw fail(429, DAILY_LIMIT_CODE, `每人每天最多製作 ${DAILY_ARTWORK_LIMIT} 張作品`)
      }
      // 驗證尺寸 1080 × 1080
      const probe = URL.createObjectURL(input.image)
      try {
        const img = await loadImage(probe)
        if (img.naturalWidth !== 1080 || img.naturalHeight !== 1080)
          throw fail(400, 'ARTWORK_IMAGE_INVALID', '圖片必須是 1080 x 1080')
      } finally {
        URL.revokeObjectURL(probe)
      }
      await delay(500)
      // 對應「先上傳 S3，成功後才建立資料庫紀錄」
      const id = s.nextId++
      await kvSet(`img:${id}`, input.image)
      const row: ArtworkRow = {
        id,
        ownerId: u.id,
        backgroundId: bg.id,
        policyId: input.policyId,
        sloganText: input.sloganText,
        likeCount: 0,
        downloadCount: 0,
        createdAt: new Date().toISOString(),
      }
      s.artworks.push(row)
      await persist()
      return toDto(s, row, u.id)
    },

    async getArtwork(id) {
      const { s, u } = await me()
      return toDto(s, find(s, id), u.id)
    },

    async likeArtwork(id) {
      const { s, u } = await me()
      const row = find(s, id)
      if (row.ownerId === u.id) throw fail(409, 'ARTWORK_SELF_LIKE', '作者不能對自己的作品按愛心')
      const key = `${u.id}:${id}`
      if (!s.likes.includes(key)) {
        s.likes.push(key)
        row.likeCount++
        await persist()
      }
      return { artworkId: id, liked: true, likeCount: row.likeCount }
    },

    async unlikeArtwork(id) {
      const { s, u } = await me()
      const row = find(s, id)
      const key = `${u.id}:${id}`
      const i = s.likes.indexOf(key)
      if (i >= 0) {
        s.likes.splice(i, 1)
        row.likeCount = Math.max(0, row.likeCount - 1)
        await persist()
      }
      return { artworkId: id, liked: false, likeCount: row.likeCount }
    },

    async downloadArtwork(id) {
      const { s, u } = await me()
      const row = find(s, id)
      const policy = MOCK_POLICIES.find((p) => p.id === row.policyId)
      if (!policy?.sourceUrl.startsWith('https://')) throw fail(404, 'POLICY_SOURCE_MISSING', '政策缺少來源網址')
      let image = await kvGet<Blob>(`img:${id}`)
      if (!image) {
        const c = createCanvas()
        renderScene(c.getContext('2d')!, { background: null, layers: defaultLayers('早安', row.sloganText) })
        image = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'))
      }
      const blob = await composeWithQr(image, policy.sourceUrl)
      if (row.ownerId !== u.id) {
        row.downloadCount++
        await persist()
      }
      return { blob, filename: `artwork-${id}.png` }
    },

    async getLeaderboard() {
      const { s, u } = await me()
      const ranked = rankArtworks(s.artworks, 100)
      return Promise.all(ranked.map(async (r) => ({ rank: r.rank, score: r.score, artwork: await toDto(s, r.artwork, u.id) })))
    },
  }
}
