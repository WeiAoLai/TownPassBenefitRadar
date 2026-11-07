import { ApiError, NetworkError } from './errors'
import type { Api, Artwork, ArtworkPage, Background, CurrentUser, LeaderboardEntry, LikeState, Policy } from './types'

const TIMEOUT_MS = 20_000

export function createHttpApi(baseUrl: string, getUser: () => string): Api {
  const base = baseUrl.replace(/\/$/, '')

  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const headers = new Headers(init.headers)
    headers.set('X-Demo-User', getUser())
    if (!headers.has('Accept')) headers.set('Accept', 'application/json, application/problem+json')
    let res: Response
    try {
      res = await fetch(base + path, { ...init, headers, signal: ctrl.signal })
    } catch {
      throw new NetworkError()
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) {
      let problem = {}
      try {
        problem = await res.json()
      } catch {
        /* 非 JSON 錯誤內容 */
      }
      const ra = Number(res.headers.get('Retry-After'))
      throw ApiError.fromProblem(problem, res.status, Number.isFinite(ra) && ra > 0 ? ra : undefined)
    }
    return res
  }

  const json = async <T>(path: string, init?: RequestInit) => (await call(path, init)).json() as Promise<T>
  const q = (page = 0, size = 20) => `?page=${page}&size=${size}`

  return {
    getCurrentUser: () => json<CurrentUser>('/me'),
    listMyArtworks: (page, size) => json<ArtworkPage>('/me/artworks' + q(page, size)),
    listBackgrounds: () => json<Background[]>('/backgrounds'),
    listPolicyCategories: () => json<string[]>('/policy-categories'),
    listPolicies: (category) => json<Policy[]>('/policies?category=' + encodeURIComponent(category)),
    getRandomPolicy: () => json<Policy>('/policies/random'),
    listArtworks: (page, size) => json<ArtworkPage>('/artworks' + q(page, size)),
    async createArtwork(input) {
      const form = new FormData()
      form.append('image', input.image, 'artwork.png')
      form.append('backgroundId', String(input.backgroundId))
      form.append('policyId', String(input.policyId))
      form.append('sloganText', input.sloganText)
      return json<Artwork>('/artworks', { method: 'POST', body: form })
    },
    getArtwork: (id) => json<Artwork>(`/artworks/${id}`),
    likeArtwork: (id) => json<LikeState>(`/artworks/${id}/like`, { method: 'PUT' }),
    unlikeArtwork: (id) => json<LikeState>(`/artworks/${id}/like`, { method: 'DELETE' }),
    async downloadArtwork(id) {
      const res = await call(`/artworks/${id}/download`, { headers: { Accept: 'image/png, application/problem+json' } })
      const cd = res.headers.get('Content-Disposition') ?? ''
      const m = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
      return { blob: await res.blob(), filename: m ? decodeURIComponent(m[1]) : `artwork-${id}.png` }
    },
    getLeaderboard: () => json<LeaderboardEntry[]>('/leaderboard'),
  }
}
