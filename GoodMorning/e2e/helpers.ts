import { expect, type Page } from '@playwright/test'

export const PHOTO = new URL('./fixtures/photo.jpg', import.meta.url).pathname

/** 讀取編輯中的草稿（localStorage gm.draft.v1） */
export function draft(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('gm.draft.v1') || 'null'))
}

/** 打開製作首頁並等資料載入完成 */
export async function openCreate(page: Page) {
  await page.goto('./#/create')
  await expect(page.getByRole('button', { name: '幫我做一張' })).toBeEnabled({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
}

/** 從簡易流程進入完整編輯器 */
export async function openEditor(page: Page) {
  await openCreate(page)
  await page.getByRole('button', { name: '幫我做一張' }).click()
  await expect(page.getByRole('heading', { name: '這張可以嗎？' })).toBeVisible()
  await page.getByRole('button', { name: '自行調整' }).click()
  await expect(page.getByRole('tab', { name: '背景' })).toBeVisible()
}

/** 按「隨機一張」並等政策、背景都載入完成 */
export async function randomize(page: Page) {
  const before = (await draft(page))?.policy?.id ?? null
  await page.getByRole('button', { name: /隨機一張/ }).click()
  await expect.poll(async () => (await draft(page))?.policy != null).toBe(true)
  await expect(page.getByRole('button', { name: /隨機一張/ })).toBeEnabled()
  await page.waitForLoadState('networkidle')
  return before
}

export const saveButton = (page: Page) => page.locator('.actionbar .btn.primary')

/** 按儲存；拿到新徽章時先關掉慶祝畫面，最後停在完成視窗 */
export async function saveArtwork(page: Page) {
  await saveButton(page).click()
  const ok = page.getByRole('button', { name: '太棒了！' })
  const sheet = page.getByRole('dialog', { name: '完成' })
  await expect(ok.or(sheet)).toBeVisible({ timeout: 15_000 })
  if (await ok.isVisible()) await ok.click()
  await expect(sheet).toBeVisible()
  return sheet
}

/** 找出畫布上縮放把手的位置（把手外框是 TownPass 主色 #5AB4C5） */
export async function findHandle(page: Page): Promise<{ x: number; y: number } | null> {
  const found: { h: { x: number; y: number } | null } = { h: null }
  await expect.poll(async () => (found.h = await scanHandle(page)) != null, { timeout: 5_000 }).toBe(true)
  return found.h
}

function scanHandle(page: Page) {
  return page.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement
    const ctx = c.getContext('2d')!
    const { width: w, height: h } = c
    const d = ctx.getImageData(0, 0, w, h).data
    const mask = new Uint8Array(w * h)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        if (Math.abs(d[i] - 0x5a) < 12 && Math.abs(d[i + 1] - 0xb4) < 12 && Math.abs(d[i + 2] - 0xc5) < 12) {
          mask[y * w + x] = 1
        }
      }

    // 把手中心有藍綠色箭頭，外圍是半徑 44px @1080 的藍綠色圓環。
    // 直接比對這個幾何特徵，避免照片裡相近顏色干擾。
    let best: { x: number; y: number; score: number; ring: number } | null = null
    const scale = w / 1080
    const handleRadius = 44 * scale
    const edge = Math.ceil(handleRadius + 4)
    const white = (x: number, y: number) => {
      const i = (y * w + x) * 4
      return d[i] > 238 && d[i + 1] > 238 && d[i + 2] > 238
    }
    for (let y = edge; y < h - edge; y++) {
      for (let x = edge; x < w - edge; x++) {
        if (mask[y * w + x] !== 1) continue
        let ring = 0
        for (let a = 0; a < 24; a++) {
          const angle = (a * Math.PI * 2) / 24
          let matched = false
          for (let offset = -3; offset <= 3 && !matched; offset++) {
            const radius = handleRadius + offset
            const sx = Math.round(x + Math.cos(angle) * radius)
            const sy = Math.round(y + Math.sin(angle) * radius)
            matched = mask[sy * w + sx] === 1
          }
          if (matched) ring++
        }
        const inside = Math.max(8, Math.round(25 * scale))
        const whiteInside = Number(white(x - inside, y)) + Number(white(x + inside, y)) + Number(white(x, y - inside)) + Number(white(x, y + inside))
        const score = ring * 10 + whiteInside
        if (!best || score > best.score) best = { x, y, score, ring }
      }
    }
    if (!best || best.ring < 10) return null
    const cx = best.x
    const cy = best.y
    const r = c.getBoundingClientRect()
    return { x: r.left + (cx / w) * r.width, y: r.top + (cy / h) * r.height }
  })
}
