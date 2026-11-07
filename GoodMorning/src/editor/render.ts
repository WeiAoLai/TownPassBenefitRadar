import { SIZE, layoutLayer, type Layout, type TextLayer } from './layout'
import { fontByKey, styleById } from './styles'

export type Drawable = HTMLImageElement | HTMLCanvasElement | ImageBitmap

export interface Scene {
  background: Drawable | null
  layers: TextLayer[]
}

export const fontString = (layer: Pick<TextLayer, 'font'>, size: number) => {
  const f = fontByKey(layer.font)
  return `${f.weight} ${size}px ${f.family}`
}

/** 等實際會畫進 canvas 的字型與字元載入完成，避免 Android 先用同一套 fallback 字型輸出。 */
export async function loadLayerFonts(layers: Pick<TextLayer, 'font' | 'size' | 'text'>[]): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  await Promise.all(layers.map((layer) => document.fonts.load(fontString(layer, layer.size), layer.text || '早安')))
}

export function measurerFor(ctx: CanvasRenderingContext2D, layer: TextLayer) {
  return (text: string, size: number) => {
    ctx.font = fontString(layer, size)
    return ctx.measureText(text).width
  }
}

export function layoutsFor(ctx: CanvasRenderingContext2D, layers: TextLayer[]): Layout[] {
  return layers.map((l) => layoutLayer(l, measurerFor(ctx, l)))
}

function drawCover(ctx: CanvasRenderingContext2D, img: Drawable) {
  const iw = 'naturalWidth' in img ? img.naturalWidth : img.width
  const ih = 'naturalHeight' in img ? img.naturalHeight : img.height
  if (!iw || !ih) return
  const s = Math.max(SIZE / iw, SIZE / ih)
  const w = iw * s
  const h = ih * s
  ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h)
}

function drawLayer(ctx: CanvasRenderingContext2D, layer: TextLayer, layout: Layout) {
  const style = styleById(layer.styleId)
  const fs = layout.fontSize
  ctx.save()
  ctx.font = fontString(layer, fs)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2

  // 1) 筆畫：由寬到窄，光暈只加在最外層
  style.strokes.forEach((s, i) => {
    ctx.save()
    if (i === 0 && style.glow) {
      ctx.shadowColor = style.glow.color
      ctx.shadowBlur = style.glow.blur * fs
    }
    ctx.lineWidth = s.width * fs
    ctx.strokeStyle = s.color
    for (const g of layout.glyphs) ctx.strokeText(g.text, g.cx, g.cy)
    ctx.restore()
  })

  // 2) 填色：漸層以每一行（直書以每一欄）的高度為範圍
  for (const g of layout.glyphs) {
    if (Array.isArray(style.fill)) {
      const span = layer.vertical ? layout.box : { y: g.cy - g.h / 2, h: g.h }
      const grad = ctx.createLinearGradient(0, span.y, 0, span.y + span.h)
      style.fill.forEach((c, i) => grad.addColorStop(i / Math.max(1, style.fill.length - 1), c))
      ctx.fillStyle = grad
    } else {
      ctx.fillStyle = style.fill
    }
    ctx.fillText(g.text, g.cx, g.cy)
  }
  ctx.restore()
}

/** 預設背景：沒有選背景時的柔和天空漸層 */
function drawFallback(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, SIZE)
  g.addColorStop(0, '#7ec8f5')
  g.addColorStop(1, '#e6f6ff')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, SIZE, SIZE)
}

/** 縮放把手半徑（1080 座標） */
export const HANDLE_R = 44
export const handlePoint = (b: Layout['box']) => ({
  x: Math.min(SIZE - HANDLE_R - 4, b.x + b.w),
  y: Math.min(SIZE - HANDLE_R - 4, b.y + b.h),
})

export interface RenderOptions {
  /** 編輯時標示選取中的文字框 */
  selected?: number | null
  /** 編輯時以虛線標示下載後 QR Code 會蓋住的位置 */
  qrZone?: { x: number; y: number; w: number; h: number } | null
}

export function renderScene(ctx: CanvasRenderingContext2D, scene: Scene, opts: RenderOptions = {}): Layout[] {
  ctx.clearRect(0, 0, SIZE, SIZE)
  if (scene.background) drawCover(ctx, scene.background)
  else drawFallback(ctx)
  const layouts = layoutsFor(ctx, scene.layers)
  scene.layers.forEach((l, i) => drawLayer(ctx, l, layouts[i]))

  if (opts.qrZone) {
    const z = opts.qrZone
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillRect(z.x, z.y, z.w, z.h)
    ctx.lineWidth = 4
    ctx.setLineDash([14, 10])
    ctx.strokeStyle = 'rgba(48,56,61,0.7)'
    ctx.strokeRect(z.x, z.y, z.w, z.h)
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(48,56,61,0.85)'
    ctx.font = '600 30px "PingFang TC","Noto Sans TC",sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('QR Code', z.x + z.w / 2, z.y + z.h / 2 - 20)
    ctx.fillText('位置', z.x + z.w / 2, z.y + z.h / 2 + 22)
    ctx.restore()
  }

  const sel = opts.selected
  if (sel != null && layouts[sel] && layouts[sel].glyphs.length) {
    const b = layouts[sel].box
    ctx.save()
    ctx.lineWidth = 6
    ctx.setLineDash([22, 14])
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'
    ctx.strokeRect(b.x, b.y, b.w, b.h)
    ctx.lineDashOffset = 18
    ctx.strokeStyle = 'rgba(70,141,155,0.95)'
    ctx.strokeRect(b.x, b.y, b.w, b.h)
    // 右下角縮放把手：拖曳可放大縮小文字
    const h = handlePoint(b)
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.arc(h.x, h.y, HANDLE_R, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.lineWidth = 6
    ctx.strokeStyle = '#5ab4c5'
    ctx.stroke()
    ctx.beginPath()
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.moveTo(h.x - 14, h.y - 14)
    ctx.lineTo(h.x + 11, h.y + 11)
    ctx.moveTo(h.x + 11, h.y + 11)
    ctx.lineTo(h.x + 11, h.y + 1)
    ctx.moveTo(h.x + 11, h.y + 11)
    ctx.lineTo(h.x + 1, h.y + 11)
    ctx.moveTo(h.x - 14, h.y - 14)
    ctx.lineTo(h.x - 11, h.y - 1)
    ctx.moveTo(h.x - 14, h.y - 14)
    ctx.lineTo(h.x - 1, h.y - 11)
    ctx.stroke()
    ctx.restore()
  }
  return layouts
}

export function createCanvas(size = SIZE): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  return c
}

/** 輸出 1080 × 1080 PNG（openapi createArtwork 規格） */
export async function exportPng(scene: Scene): Promise<Blob> {
  const c = createCanvas()
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('canvas 不支援')
  renderScene(ctx, scene)
  return canvasToBlob(c)
}

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('無法輸出圖片'))), type)
    } catch (e) {
      // 背景圖跨網域且沒有 CORS 時，畫布會被汙染而無法輸出
      reject(e)
    }
  })
}

/**
 * 載入圖片。先以 CORS 模式載入（S3 開了 CORS、同網域、data/blob 都可輸出 PNG）；
 * 對方沒開 CORS 時改用一般模式，仍可顯示預覽，但標記為 tainted：畫進 canvas 後無法輸出。
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  const load = (cors: boolean) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      if (cors) img.crossOrigin = 'anonymous'
      img.decoding = 'async'
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('圖片載入失敗'))
      img.src = src
    })
  const sameOrigin = src.startsWith('data:') || src.startsWith('blob:') || new URL(src, document.baseURI).origin === location.origin
  if (sameOrigin) return load(false)
  return load(true).catch(() =>
    load(false).then((img) => {
      img.dataset.tainted = '1'
      return img
    }),
  )
}

export const isTainted = (img: Drawable | null) => !!img && 'dataset' in img && (img as HTMLImageElement).dataset.tainted === '1'

/** 樣式預覽小圖 */
export function styleSwatch(styleId: string, font: TextLayer['font'] = 'sans', px = 120): string {
  const c = createCanvas(px)
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#9fb8c4'
  ctx.fillRect(0, 0, px, px)
  const scale = px / SIZE
  ctx.scale(scale, scale)
  const layer: TextLayer = { text: '早', x: 0.5, y: 0.52, size: 760, vertical: false, styleId, font }
  const layout = layoutLayer(layer, measurerFor(ctx, layer))
  drawLayer(ctx, layer, layout)
  return c.toDataURL('image/png')
}
