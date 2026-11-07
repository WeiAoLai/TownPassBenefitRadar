import { expect, test } from '@playwright/test'
import { PHOTO, draft, findHandle, openCreate, openEditor, randomize, saveArtwork, saveButton } from './helpers'

test.describe('製作長輩圖', () => {
  test('先產生預覽，點自行調整才顯示編輯器', async ({ page }) => {
    await openCreate(page)
    await expect(page.getByRole('heading', { name: '今天想傳張圖嗎？' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '背景' })).toHaveCount(0)
    const starter = page.locator('.starter-art img')
    await expect(starter).toHaveAttribute('src', /backgrounds\/taipei101-sunset\.jpg$/)
    await expect.poll(() => starter.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)

    await page.getByRole('button', { name: '幫我做一張' }).click()
    await expect(page.getByRole('heading', { name: '這張可以嗎？' })).toBeVisible()
    const generated = await draft(page)
    const grid = new Set(['0.2,0.18', '0.5,0.18', '0.8,0.18', '0.2,0.5', '0.5,0.5', '0.8,0.5', '0.2,0.72', '0.5,0.72', '0.8,0.72'])
    const positions = generated.layers.map((layer: { x: number; y: number }) => `${layer.x},${layer.y}`)
    expect(grid.has(positions[0])).toBe(true)
    expect(grid.has(positions[1])).toBe(true)
    expect(positions[0]).not.toBe(positions[1])
    await expect(page.getByRole('button', { name: '換一張' })).toBeVisible()
    await expect(page.getByRole('button', { name: '儲存', exact: true })).toBeVisible()
    await expect(page.getByRole('tab', { name: '背景' })).toHaveCount(0)
    await expect(page.locator('.toast')).toHaveCount(0)

    const selected = generated.selected
    const selectedLayer = generated.layers[selected]
    const canvas = page.locator('canvas[role="img"]')
    const canvasBox = await canvas.boundingBox()
    expect(canvasBox, '找不到預覽畫布').not.toBeNull()
    const startX = canvasBox!.x + selectedLayer.x * canvasBox!.width
    const startY = canvasBox!.y + selectedLayer.y * canvasBox!.height
    const moveX = selectedLayer.x > 0.6 ? -28 : 28
    const moveY = selectedLayer.y > 0.6 ? -28 : 28
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + moveX, startY + moveY, { steps: 5 })
    await page.mouse.up()
    const moved = await draft(page)
    expect(Math.abs(moved.layers[selected].x - selectedLayer.x) + Math.abs(moved.layers[selected].y - selectedLayer.y)).toBeGreaterThan(0.02)

    const handle = await findHandle(page)
    expect(handle, '預覽畫面找不到縮放把手').not.toBeNull()
    await page.mouse.move(handle!.x, handle!.y)
    await page.mouse.down()
    await page.mouse.move(handle!.x + 36, handle!.y + 36, { steps: 5 })
    await page.mouse.up()
    const resized = await draft(page)
    expect(resized.layers[selected].size).toBeGreaterThan(generated.layers[selected].size)

    await page.getByRole('button', { name: '自行調整' }).click()
    await expect(page.getByRole('tab', { name: '背景' })).toHaveAttribute('aria-selected', 'true')
  })

  test('接受預覽可直接儲存，不必開啟編輯器', async ({ page }) => {
    await openCreate(page)
    await page.getByRole('button', { name: '幫我做一張' }).click()
    await page.getByRole('button', { name: '儲存', exact: true }).click()
    const ok = page.getByRole('button', { name: '太棒了！' })
    const done = page.getByRole('dialog', { name: '完成' })
    await expect(ok.or(done)).toBeVisible({ timeout: 15_000 })
    if (await ok.isVisible()) await ok.click()
    await expect(done.getByText('作品已儲存')).toBeVisible()
    await expect(done.getByRole('button', { name: '分享給親友' })).toBeVisible()
  })

  test('隨機一張 → 儲存 → 分享給親友', async ({ page }) => {
    await openEditor(page)
    await randomize(page)
    await expect(page.locator('canvas[role="img"]')).toHaveAttribute('aria-label', /標語「(?!尚未選擇)/)

    const sheet = await saveArtwork(page)
    await expect(sheet.getByText('今天還能再做 2 張')).toBeVisible()

    await sheet.getByRole('button', { name: '分享給親友' }).click()
    await expect(page.getByRole('dialog', { name: /存到手機相簿|下載/ })).toBeVisible()
  })

  test('每人每天最多 3 張：第 4 張不能儲存', async ({ page }) => {
    await openEditor(page)
    for (let i = 0; i < 3; i++) {
      await randomize(page)
      const sheet = await saveArtwork(page)
      await sheet.press('Escape')
      await expect(sheet).toBeHidden()
    }
    await expect(saveButton(page)).toBeDisabled()
    await expect(saveButton(page)).toContainText('今天已做滿')
    await expect(page.locator('.actionbar .one-line')).toContainText('今天的 3 張做完了')

    const full = saveButton(page)
    const color = () => full.evaluate((el) => getComputedStyle(el).backgroundColor)
    const idleColor = await color()
    await full.hover({ force: true })
    expect(await color()).toBe(idleColor)
    const box = await full.boundingBox()
    expect(box, '找不到今天已做滿按鈕').not.toBeNull()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.mouse.down()
    expect(await color()).toBe(idleColor)
    await page.mouse.up()
  })

  test('政策標語不能修改，問候語可以', async ({ page }) => {
    await openEditor(page)
    await randomize(page)
    await page.getByRole('tab', { name: '文字' }).click()

    await page.getByRole('radio', { name: '政策標語' }).click()
    const panel = page.locator('#tool-panel-text')
    await expect(panel.locator('textarea')).toHaveCount(0)
    const policySlogan = (await draft(page)).policy.slogan
    const shown = await panel.locator('.text-box').innerText()
    expect(shown.replace(/\s+/g, '')).toBe(policySlogan.replace(/\s+/g, ''))

    await page.getByRole('radio', { name: '問候語' }).click()
    await panel.locator('textarea').fill('週末愉快')
    await expect(page.locator('canvas[role="img"]')).toHaveAttribute('aria-label', /問候語「週末愉快」/)
  })

  test('舊草稿裡被改過的標語，打開後還原成政策原文', async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem(
        'gm.draft.v1',
        JSON.stringify({
          backgroundId: 1,
          policy: { id: 5, category: '防詐騙', title: '165 反詐騙', slogan: '接到可疑電話\n先掛斷再查證\n撥打165', sourceUrl: 'https://165.npa.gov.tw/', startDate: '2026-01-01', endDate: '2026-12-31' },
          layers: [
            { text: '早安', x: 0.84, y: 0.34, size: 180, vertical: true, styleId: 'red-orange', font: 'sans' },
            { text: '被改過的標語', x: 0.42, y: 0.6, size: 92, vertical: false, styleId: 'gold-blue', font: 'sans' },
          ],
          selected: 1,
        }),
      )
    })
    await openCreate(page)
    await expect.poll(async () => (await draft(page)).layers[1].text).toBe('接到可疑電話\n先掛斷再查證\n撥打165')
  })

  test('文字可直接拖曳，縮放把手會連同字體一起縮放', async ({ page }) => {
    await openEditor(page)
    await randomize(page)
    await page.getByRole('tab', { name: '樣式' }).click()
    const before = await draft(page)
    const sel = before.selected
    const h = await findHandle(page)
    expect(h, '找不到縮放把手').not.toBeNull()
    await page.mouse.move(h!.x, h!.y)
    await page.mouse.down()
    await page.mouse.move(h!.x + 50, h!.y + 50, { steps: 6 })
    await page.mouse.up()
    const after = await draft(page)
    expect(after.layers[sel].size).toBeGreaterThan(before.layers[sel].size)
    expect(after.layers[sel].boxW).toBeGreaterThan(0)
  })

  test('Android 可切換粗黑體、明體與楷書', async ({ page }) => {
    await openEditor(page)
    await page.getByRole('tab', { name: '樣式' }).click()
    const hashes: string[] = []
    for (const [name, key] of [
      ['粗黑體', 'sans'],
      ['明體', 'serif'],
      ['楷書', 'kai'],
    ] as const) {
      await page.getByRole('radio', { name }).click()
      await expect.poll(async () => {
        const current = await draft(page)
        return current.layers[current.selected].font
      }).toBe(key)
      await page.evaluate(async () => {
        await document.fonts.ready
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      })
      hashes.push(await page.locator('canvas[role="img"]').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL()))
    }
    expect(new Set(hashes).size).toBe(3)
  })
})

test('政策類別用下拉選單切換', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('tab', { name: '政策' }).click()
  const select = page.getByRole('combobox', { name: /選政策類別/ })
  await expect(select).toBeVisible()
  await select.selectOption('防詐騙')
  await expect(page.getByRole('radiogroup', { name: '政策' }).getByRole('radio', { name: /165 反詐騙/ })).toBeVisible()
  await page.getByRole('radio', { name: /165 反詐騙/ }).click()
  await expect.poll(async () => (await draft(page)).policy?.title).toBe('165 反詐騙')
})

test.describe('背景', () => {
  test('第一格是「我的照片」，選照片後打勾', async ({ page }) => {
    await openEditor(page)
    await page.getByRole('tab', { name: '背景' }).click()
    const mine = page.getByRole('radio', { name: '用自己的照片' })
    await expect(mine).toBeVisible()
    await page.locator('input[type="file"]').setInputFiles(PHOTO)
    await expect(page.getByRole('radio', { name: /我的照片/ })).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('canvas[role="img"]')).toHaveAttribute('aria-label', /背景「我的照片」/)
  })

  test('沒有多餘的說明與定位按鈕；鎖住的背景點了只提示', async ({ page }) => {
    await openEditor(page)
    await page.getByRole('tab', { name: '背景' }).click()
    await expect(page.getByText('離我最近的地標排前面')).toHaveCount(0)
    await expect(page.locator('.bg-current')).toHaveCount(0)

    const locked = page.locator('.bg-item.locked')
    await expect(locked).toHaveCount(2)
    await expect(locked.first()).toContainText('存 3 張解鎖')
    const before = (await draft(page)).backgroundId
    // aria-disabled 的格子 Playwright 視為不可點，直接送出點擊事件模擬手指點下去
    await locked.first().dispatchEvent('click')
    await expect(page.locator('.editor-feedback').filter({ hasText: /再儲存 \d+ 張作品就能解鎖/ })).toBeVisible()
    expect((await draft(page)).backgroundId).toBe(before)
  })

  test('觸控目標至少 48 × 48', async ({ page }) => {
    await openEditor(page)
    for (const tab of ['背景', '政策', '文字', '樣式']) {
      await page.getByRole('tab', { name: tab }).click()
      const small = await page.locator('.panel button, .panel a, .panel input:not([type=file]), .actionbar button').evaluateAll((els) =>
        els
          .filter((e) => (e as HTMLElement).offsetParent !== null)
          .map((e) => ({ t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20), r: e.getBoundingClientRect() }))
          .filter(({ r }) => r.width < 47.5 || r.height < 47.5)
          .map(({ t, r }) => `${t} ${Math.round(r.width)}×${Math.round(r.height)}`),
      )
      expect(small, `「${tab}」分頁有過小的觸控目標`).toEqual([])
    }
  })

  test('樣式頁不顯示大小與位置控制', async ({ page }) => {
    await openEditor(page)
    await page.getByRole('tab', { name: '樣式' }).click()
    await expect(page.getByRole('heading', { name: '大小與位置' })).toHaveCount(0)
    await expect(page.getByRole('group', { name: '快速放到九宮格位置' })).toHaveCount(0)
    await expect(page.getByRole('group', { name: '微調大小與位置' })).toHaveCount(0)
  })
})
