import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * 長輩友善化的對比與字級下限，直接讀 src/css/tokens.css，之後有人改色票或字級會在這裡被擋下。
 * WCAG AA：一般文字 4.5:1、非文字元件（框線、開關軌道）3:1。
 */
const css = readFileSync(new URL('../src/css/tokens.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const vars = new Map<string, string>()
for (const m of css.matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars.set(m[1], m[2].trim())

/** 把 --token（含 var(--other) 別名）或 #rrggbb 解成 #rrggbb */
function hex(ref: string): string {
  let v = ref
  for (let i = 0; i < 5 && !v.startsWith('#'); i++) {
    const name = v.startsWith('var(') ? v.slice(4, -1).trim() : v
    const next = vars.get(name)
    if (!next) throw new Error(`找不到色票 ${ref}`)
    v = next
  }
  if (!/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`${ref} 不是 6 碼色碼：${v}`)
  return v
}

function luminance(h: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(fg: string, bg: string): number {
  const [hi, lo] = [luminance(hex(fg)), luminance(hex(bg))].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

const rem = (name: string) => {
  const m = /^([\d.]+)rem$/.exec(vars.get(name) ?? '')
  if (!m) throw new Error(`${name} 不是 rem 值`)
  return parseFloat(m[1])
}

describe('文字對比 ≥ 4.5:1', () => {
  const pairs: [string, string, string][] = [
    ['#ffffff', '--c-action', '主要按鈕：白字 on 主操作色'],
    ['#ffffff', '--c-action-press', '主要按鈕按下'],
    ['--c-action', '--c-surface', '次要按鈕／連結／選取中的分頁文字 on 白'],
    ['--c-action', '--c-bg', '同上 on 頁面底色'],
    ['--tp-primary-800', '--tp-primary-50', '選取中的標籤文字 on primary-50'],
    ['--c-text', '--c-bg', '內文'],
    ['--c-text-2', '--c-surface', '次要文字 on 白'],
    ['--c-text-3', '--c-surface', '輔助文字／placeholder on 白'],
    ['--c-text-3', '--c-bg', '輔助文字 on 頁面底色'],
    ['#ffffff', '--c-danger-strong', '錯誤 toast、警示按鈕'],
    ['--c-like', '--c-surface', '已按愛心的數字 on 白'],
    ['--tp-secondary-800', '--c-accent-soft', '徽章標籤、提示框'],
    ['--tp-grey-950', '--tp-secondary-500', '金色按鈕／第一名'],
    ['--tp-grey-950', '--tp-grey-200', '第二名'],
    ['--tp-grey-950', '--tp-orange-300', '第三名'],
    ['#ffffff', '--tp-primary-700', '成功 toast'],
    ['--tp-grey-800', '--c-surface', '導覽與標籤文字'],
  ]
  it.each(pairs)('%s on %s（%s）', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('停用按鈕的文字至少 4:1（原本 2.94）', () => {
    expect(contrast('--tp-grey-600', '--c-disable')).toBeGreaterThanOrEqual(4)
  })
})

describe('非文字元件 ≥ 3:1', () => {
  const pairs: [string, string, string][] = [
    ['--c-action', '--c-surface', '焦點框、選取框'],
    ['--tp-grey-500', '--c-surface', '開關關閉時的軌道、箭頭'],
  ]
  it.each(pairs)('%s vs %s（%s）', (a, b) => {
    expect(contrast(a, b)).toBeGreaterThanOrEqual(3)
  })
})

describe('字級下限', () => {
  it('內文 ≥ 18px、輔助文字 ≥ 16px（以 16px = 1rem 計）', () => {
    expect(rem('--tp-font-h3')).toBeGreaterThanOrEqual(1.125)
    expect(rem('--tp-font-body')).toBeGreaterThanOrEqual(1)
  })

  it('根字級依螢幕寬度縮放：Pixel Pro（412）以上 16px、最小 13px，上下限以 rem 表示（跟著使用者字級設定）', () => {
    const base = readFileSync(new URL('../src/css/base.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const m = /(?:^|\n)html\s*\{[^}]*?font-size:\s*([^;]+);/.exec(base)
    expect(m, 'base.css 找不到 html { font-size }').not.toBeNull()
    const c = /^clamp\(\s*([\d.]+)rem\s*,\s*calc\(\s*([\d.]+)vw\s*-\s*([\d.]+)rem\s*\)\s*,\s*([\d.]+)rem\s*\)$/.exec(m![1].trim())
    expect(c, '根字級應為 clamp(最小rem, calc(Xvw - Yrem), 最大rem)').not.toBeNull()
    const [min, vw, sub, max] = c!.slice(1).map(Number)
    const px = (width: number) => Math.min(max * 16, Math.max(min * 16, (vw / 100) * width - sub * 16))
    expect(min * 16).toBeGreaterThanOrEqual(13)
    expect(max).toBe(1)
    expect(px(412)).toBeCloseTo(16, 0)
    // 內文（1.125rem）在 iPhone 13 寬度仍 ≥ 16px
    expect(px(390) * 1.125).toBeGreaterThanOrEqual(16)
  })
})
