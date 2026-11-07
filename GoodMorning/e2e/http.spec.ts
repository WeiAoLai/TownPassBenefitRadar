import { expect, test, type Route } from '@playwright/test'
import { openEditor, randomize, saveArtwork } from './helpers'

/**
 * 串接模式：瀏覽器打的 /api/v1/** 由這裡的假後端回應（照 openapi.yaml），
 * 驗證每個請求都在 /api/v1 底下、都帶 X-Demo-User，且儲存送出的是政策原文與後端存在的背景 id。
 */
test('串接模式：所有請求走 /api/v1 並帶 X-Demo-User', async ({ page }) => {
  const calls: { method: string; path: string; user: string | null; body?: string }[] = []
  let count = 0
  const policy = { id: 1, category: '民生費用', title: '地價稅開徵', slogan: '十一月地價稅開徵\n記得準時繳納', sourceUrl: 'https://tpctax.gov.taipei/', startDate: '2026-01-01', endDate: '2026-12-31' }
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    calls.push({ method: req.method(), path: url.pathname + url.search, user: req.headers()['x-demo-user'] ?? null, body: req.method() === 'POST' ? req.postDataBuffer()?.toString('utf8') : undefined })
    const p = url.pathname.replace(/^\/api\/v1/, '')
    if (!url.pathname.startsWith('/api/v1/')) return json(route, { type: 'about:blank', title: 'Not Found', status: 404, code: 'NOT_FOUND', traceId: 't' }, 404)
    if (p === '/me') return json(route, { id: 1, account: 'user-a', displayName: '小明', artworkCount: count, badge: null, createdAt: '2026-11-07T00:00:00Z' })
    if (p === '/me/artworks' || (p === '/artworks' && req.method() === 'GET')) return json(route, { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 })
    if (p === '/backgrounds') return json(route, [{ id: 7, name: '台北晨曦', imageUrl: 'https://example.invalid/s3.png', unlockThreshold: 0, unlocked: true }])
    if (p === '/policy-categories') return json(route, ['民生費用'])
    if (p === '/policies') return json(route, [policy])
    if (p === '/policies/random') return json(route, policy)
    if (p === '/artworks' && req.method() === 'POST') {
      count++
      return json(route, { id: 99, owner: { id: 1, displayName: '小明', badge: null }, backgroundId: 7, policyId: 1, sloganText: policy.slogan, imageUrl: 'https://example.invalid/a.png', likeCount: 0, downloadCount: 0, likedByMe: false, ownedByMe: true, createdAt: new Date().toISOString() }, 201)
    }
    if (p === '/leaderboard') return json(route, [])
    return json(route, { type: 'about:blank', title: 'Not Found', status: 404, code: 'NOT_FOUND', traceId: 't' }, 404)
  })

  await openEditor(page)
  await randomize(page)
  await saveArtwork(page)

  const api = calls.filter((c) => c.path.startsWith('/api'))
  expect(api.length).toBeGreaterThan(5)
  for (const c of api) {
    expect(c.path, `${c.method} ${c.path}`).toMatch(/^\/api\/v1\//)
    expect(c.user, `${c.method} ${c.path} 沒帶 X-Demo-User`).toBe('user-a')
  }
  const post = api.find((c) => c.method === 'POST' && c.path === '/api/v1/artworks')
  expect(post, '沒有送出 POST /api/v1/artworks').toBeTruthy()
  // backgroundId 用後端存在的背景；sloganText 是政策原文
  expect(post!.body).toMatch(/name="backgroundId"\r\n\r\n7\r\n/)
  // multipart 的文字欄位換行會被瀏覽器正規化成 CRLF
  expect(post!.body).toMatch(/name="sloganText"\r\n\r\n十一月地價稅開徵\r?\n記得準時繳納\r\n/)
})
