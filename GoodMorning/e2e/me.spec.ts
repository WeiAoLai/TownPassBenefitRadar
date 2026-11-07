import { expect, test } from '@playwright/test'

/** 假的台北通 App：記錄網頁送出的訊息，並依 daily_reminder 規格回覆 */
async function fakeTownPass(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    type L = (e: { data: string }) => void
    let listeners: L[] = []
    const state: Record<string, unknown> = { enabled: false }
    ;(window as unknown as { __sent: unknown[] }).__sent = []
    ;(window as unknown as { flutterObject: unknown }).flutterObject = {
      addEventListener: (_: string, f: L) => listeners.push(f),
      removeEventListener: (_: string, f: L) => (listeners = listeners.filter((x) => x !== f)),
      postMessage(m: string) {
        const { name, data } = JSON.parse(m)
        ;(window as unknown as { __sent: unknown[] }).__sent.push({ name, data })
        let reply: unknown = null
        if (name === 'userinfo') reply = { id: '42', username: '阿明', realName: '王大明' }
        if (name === 'daily_reminder') {
          if (data.action === 'set') Object.assign(state, { enabled: true, hour: data.hour, minute: data.minute, permission: true })
          if (data.action === 'cancel') Object.assign(state, { enabled: false })
          reply = { ...state }
        }
        if (reply !== null) setTimeout(() => listeners.forEach((f) => f({ data: JSON.stringify({ name, data: reply }) })), 30)
      },
    }
  })
}

test.describe('我的', () => {
  test('一般瀏覽器：提醒開關停用並說明原因', async ({ page }) => {
    await page.goto('./#/me')
    const sw = page.getByRole('switch', { name: '每天早上提醒我' })
    await expect(sw).toBeDisabled()
    await expect(page.getByText('在台北通 App 裡打開才能設定提醒')).toBeVisible()
  })

  test('台北通裡：顯示暱稱、不顯示真實姓名；打開每日提醒送出 daily_reminder', async ({ page }) => {
    await fakeTownPass(page)
    await page.goto('./#/me')
    await expect(page.getByRole('heading', { name: '阿明' })).toBeVisible()
    await expect(page.getByText('王大明')).toHaveCount(0)

    const sw = page.getByRole('switch', { name: '每天早上提醒我' })
    await expect(sw).toBeEnabled()
    await sw.click()
    await expect(sw).toBeChecked()
    const sent = (await page.evaluate(() => (window as unknown as { __sent: { name: string; data: Record<string, unknown> }[] }).__sent)).filter(
      (m) => m.name === 'daily_reminder' && m.data.action === 'set',
    )
    expect(sent).toHaveLength(1)
    expect(sent[0].data).toMatchObject({ hour: 7, minute: 0 })
    expect(String(sent[0].data.url)).toMatch(/#\/create$/)
  })
})
