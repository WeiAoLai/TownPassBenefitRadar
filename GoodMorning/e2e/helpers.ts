import { expect, type Page } from '@playwright/test'

export const PHOTO = new URL('./fixtures/photo.jpg', import.meta.url).pathname

/** 讀取編輯中的草稿（localStorage gm.draft.v1） */
export function draft(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('gm.draft.v1') || 'null'))
}

/** 打開製作頁並等資料載入完成 */
export async function openEditor(page: Page) {
  await page.goto('./#/create')
  await expect(page.getByRole('button', { name: /隨機一張/ })).toBeEnabled({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
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

/** 按儲存；拿到新徽章時先關掉慶祝畫面，最後停在「儲存成功」視窗 */
export async function saveArtwork(page: Page) {
  await saveButton(page).click()
  const ok = page.getByRole('button', { name: '太棒了！' })
  const sheet = page.getByRole('dialog', { name: '儲存成功' })
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
    let best: [number, number] | null = null
    const pts: [number, number][] = []
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        if (Math.abs(d[i] - 0x5a) < 12 && Math.abs(d[i + 1] - 0xb4) < 12 && Math.abs(d[i + 2] - 0xc5) < 12) {
          pts.push([x, y])
          if (!best || x + y > best[0] + best[1]) best = [x, y]
        }
      }
    if (!best) return null
    const near = pts.filter((q) => Math.hypot(q[0] - best![0], q[1] - best![1]) < w * 0.09)
    const cx = near.reduce((a, q) => a + q[0], 0) / near.length
    const cy = near.reduce((a, q) => a + q[1], 0) / near.length
    const r = c.getBoundingClientRect()
    return { x: r.left + (cx / w) * r.width, y: r.top + (cy / h) * r.height }
  })
}
