import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpApi } from '../src/api/http'

/** openapi.yaml 的 13 個端點，前端都要打到 /api/v1 並帶 X-Demo-User */
describe('http API：所有端點都在 /api/v1 底下', () => {
  const calls: { method: string; url: string; user: string | null }[] = []
  const ok = (body: unknown, type = 'application/json') =>
    new Response(type === 'image/png' ? new Blob([new Uint8Array([137, 80])]) : JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': type, 'Content-Disposition': 'attachment; filename="artwork-7.png"' },
    })

  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const h = new Headers(init.headers)
    calls.push({ method: init.method ?? 'GET', url, user: h.get('X-Demo-User') })
    return url.endsWith('/download') ? ok(null, 'image/png') : ok({})
  })
  afterEach(() => void (calls.length = 0))

  it('13 個端點的路徑與方法', async () => {
    const api = createHttpApi('/api/v1', () => 'user-a')
    await api.getCurrentUser()
    await api.listMyArtworks(0, 3)
    await api.listBackgrounds()
    await api.listPolicyCategories()
    await api.listPolicies('民生費用')
    await api.getRandomPolicy()
    await api.listArtworks(1, 20)
    await api.createArtwork({ image: new Blob([], { type: 'image/png' }), backgroundId: 1, policyId: 2, sloganText: '早安' })
    await api.getArtwork(7)
    await api.likeArtwork(7)
    await api.unlikeArtwork(7)
    const dl = await api.downloadArtwork(7)
    await api.getLeaderboard()

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'GET /api/v1/me',
      'GET /api/v1/me/artworks?page=0&size=3',
      'GET /api/v1/backgrounds',
      'GET /api/v1/policy-categories',
      `GET /api/v1/policies?category=${encodeURIComponent('民生費用')}`,
      'GET /api/v1/policies/random',
      'GET /api/v1/artworks?page=1&size=20',
      'POST /api/v1/artworks',
      'GET /api/v1/artworks/7',
      'PUT /api/v1/artworks/7/like',
      'DELETE /api/v1/artworks/7/like',
      'GET /api/v1/artworks/7/download',
      'GET /api/v1/leaderboard',
    ])
    expect(calls.every((c) => c.user === 'user-a')).toBe(true)
    expect(dl.filename).toBe('artwork-7.png')
  })

  it('base 結尾多一個斜線也不會變成 //', async () => {
    await createHttpApi('/api/v1/', () => 'user-b').getCurrentUser()
    expect(calls[0]).toEqual({ method: 'GET', url: '/api/v1/me', user: 'user-b' })
  })
})
