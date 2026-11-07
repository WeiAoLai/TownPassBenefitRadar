/**
 * 文字排版（純函式，不依賴 canvas，方便測試）。
 * 座標系統：畫布 SIZE × SIZE，layer.x / layer.y 是文字區塊中心點的比例（0–1）。
 */
import type { FontKey } from './styles'

export const SIZE = 1080
export const MIN_FONT = 32
const MAX_BOX = 0.92

export interface TextLayer {
  text: string
  x: number
  y: number
  /** 期望字級（px @1080）；只有超出畫布時才自動縮小 */
  size: number
  /**
   * 使用者拖曳把手設定的文字框大小（px @1080，不含內距）。
   * 橫書：寬度決定每行多長、自動換行；直書：高度決定每行幾個字。沒設定就依文字自動決定。
   */
  boxW?: number
  boxH?: number
  /**
   * 對齊：橫書是每行靠左／置中／靠右；直書是每行靠上／置中／靠下。
   * 沒設定時橫書置中、直書靠上（傳統長輩圖的樣子）。
   */
  align?: TextAlign
  vertical: boolean
  styleId: string
  font: FontKey
}

export interface Glyph {
  /** 一段要一起畫的文字：橫書是一整行，直書是一個字 */
  text: string
  cx: number
  cy: number
  w: number
  h: number
}

export interface Layout {
  fontSize: number
  glyphs: Glyph[]
  box: { x: number; y: number; w: number; h: number }
}

export type Measure = (text: string, fontSize: number) => number

export type TextAlign = 'start' | 'center' | 'end'

export const alignOf = (layer: Pick<TextLayer, 'align' | 'vertical'>): TextAlign => layer.align ?? (layer.vertical ? 'start' : 'center')

/** 不放在行首的標點 */
const NO_LINE_START = new Set('，。、！？：；」』）》〉…,.!?:;)'.split(''))

/** 直書標點換成直排字形 */
const VERTICAL_FORMS: Record<string, string> = {
  '，': '︐', '。': '︒', '、': '︑', '！': '︕', '？': '︖', '：': '︓', '；': '︔',
  '「': '﹁', '」': '﹂', '『': '﹃', '』': '﹄', '（': '︵', '）': '︶', '《': '︽', '》': '︾',
  '〈': '︿', '〉': '﹀', '…': '︙', '—': '︱', '-': '︱', '～': '≀', '~': '≀',
  ',': '︐', '!': '︕', '?': '︖', ':': '︓', ';': '︔', '(': '︵', ')': '︶',
}

/** 把字串拆成「字」，英數字連在一起不拆開 */
export function tokenize(s: string): string[] {
  return s.match(/[A-Za-z0-9%.+\-/]+|\s|./gsu) ?? []
}

export function wrapHorizontal(text: string, fontSize: number, maxW: number, measure: Measure): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const tokens = tokenize(para.trim())
    if (!tokens.length) {
      out.push('')
      continue
    }
    let line = ''
    for (const t of tokens) {
      const next = line + t
      if (line && measure(next, fontSize) > maxW && !NO_LINE_START.has(t)) {
        out.push(line.trimEnd())
        line = t.trimStart()
      } else {
        line = next
      }
    }
    if (line) out.push(line)
  }
  return out
}

export function columnsVertical(text: string, rows: number): string[][] {
  const cols: string[][] = []
  for (const para of text.split('\n')) {
    const chars = [...para.replace(/\s+/g, '')]
    if (!chars.length) {
      cols.push([])
      continue
    }
    let col: string[] = []
    for (const ch of chars) {
      if (col.length >= rows && !NO_LINE_START.has(ch)) {
        cols.push(col)
        col = []
      }
      col.push(VERTICAL_FORMS[ch] ?? ch)
    }
    cols.push(col)
  }
  return cols
}

function tryLayout(layer: TextLayer, fontSize: number, measure: Measure): Layout | null {
  const maxW = SIZE * MAX_BOX
  const maxH = SIZE * MAX_BOX
  const glyphs: Glyph[] = []
  let w: number
  let h: number

  const frameW = layer.boxW ? Math.min(layer.boxW, maxW) : 0
  const frameH = layer.boxH ? Math.min(layer.boxH, maxH) : 0

  if (!layer.vertical) {
    const lineH = fontSize * 1.22
    // 文字框寬度決定換行位置
    const lines = wrapHorizontal(layer.text, fontSize, frameW || maxW, measure)
    const contentH = lines.length * lineH
    if (contentH > maxH) return null
    const widths = lines.map((l) => measure(l, fontSize))
    w = Math.max(frameW, ...widths)
    h = Math.max(frameH, contentH)
    const align = alignOf(layer)
    // 每一行在框內的水平位置
    const lineX = (lw: number) => (align === 'start' ? -w / 2 + lw / 2 : align === 'end' ? w / 2 - lw / 2 : 0)
    lines.forEach((l, i) => glyphs.push({ text: l, cx: lineX(widths[i]), cy: -contentH / 2 + lineH * (i + 0.5), w: widths[i], h: fontSize }))
  } else {
    const step = fontSize * 1.08
    const colW = fontSize * 1.22
    // 文字框高度決定每行幾個字
    const rows = Math.max(1, Math.floor((frameH || maxH) / step))
    const cols = columnsVertical(layer.text, rows)
    const contentW = cols.length * colW
    if (contentW > maxW) return null
    const contentH = Math.max(0, ...cols.map((c) => c.length)) * step
    w = Math.max(frameW, contentW)
    h = Math.max(frameH, contentH)
    const align = alignOf(layer)
    cols.forEach((col, ci) => {
      const cx = contentW / 2 - colW * (ci + 0.5) // 由右至左
      // 每一行（直行）在框內的垂直位置
      const colH = col.length * step
      const top = align === 'start' ? -h / 2 : align === 'end' ? h / 2 - colH : -colH / 2
      col.forEach((ch, ri) => glyphs.push({ text: ch, cx, cy: top + step * (ri + 0.5), w: fontSize, h: fontSize }))
    })
  }

  // 區塊不得超出畫布：把中心點夾在可視範圍內
  const pad = fontSize * 0.25
  const half = { w: w / 2 + pad, h: h / 2 + pad }
  const cx = clamp(layer.x * SIZE, half.w, SIZE - half.w)
  const cy = clamp(layer.y * SIZE, half.h, SIZE - half.h)
  for (const g of glyphs) {
    g.cx += cx
    g.cy += cy
  }
  return { fontSize, glyphs, box: { x: cx - half.w, y: cy - half.h, w: half.w * 2, h: half.h * 2 } }
}

export function layoutLayer(layer: TextLayer, measure: Measure): Layout {
  const text = layer.text.trim()
  if (!text) return { fontSize: layer.size, glyphs: [], box: { x: layer.x * SIZE, y: layer.y * SIZE, w: 0, h: 0 } }
  for (let fs = Math.round(layer.size); fs >= MIN_FONT; fs -= 4) {
    const l = tryLayout({ ...layer, text }, fs, measure)
    if (l) return l
  }
  // 極長文字：用最小字級，仍保證不超出畫布高度（多出的部分截斷）
  return tryLayout({ ...layer, text }, MIN_FONT, measure) ?? truncated(layer, measure)
}

function truncated(layer: TextLayer, measure: Measure): Layout {
  let text = layer.text.trim()
  while (text.length > 1) {
    text = text.slice(0, -2)
    const l = tryLayout({ ...layer, text: text + '…' }, MIN_FONT, measure)
    if (l) return l
  }
  return { fontSize: MIN_FONT, glyphs: [], box: { x: 0, y: 0, w: 0, h: 0 } }
}

export function clamp(v: number, lo: number, hi: number) {
  return lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v))
}

export function hitTest(box: Layout['box'], px: number, py: number, slop = 24) {
  return px >= box.x - slop && px <= box.x + box.w + slop && py >= box.y - slop && py <= box.y + box.h + slop
}
