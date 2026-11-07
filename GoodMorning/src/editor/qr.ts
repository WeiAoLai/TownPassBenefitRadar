/**
 * 下載圖合成政策 QR Code（US-09）。
 * 正式環境由後端合成；此檔供 mock 模式使用，也是給後端參考的版面規格：
 *   - 位置：右下角，距邊 28px
 *   - 白底圓角卡 252 × 292，QR 220 × 220（含 quiet zone 2 模組），錯誤修正等級 M
 *   - 下方文字「掃我看政策」28px
 */
import { SIZE } from './layout'
import { canvasToBlob, createCanvas, loadImage } from './render'

export const QR_LAYOUT = { margin: 28, cardW: 252, cardH: 292, qr: 220, radius: 24 }

export async function composeWithQr(image: Blob, url: string): Promise<Blob> {
  const QRCode = (await import('qrcode')).default
  const qrCanvas = createCanvas(QR_LAYOUT.qr)
  await QRCode.toCanvas(qrCanvas, url, { errorCorrectionLevel: 'M', margin: 2, width: QR_LAYOUT.qr })

  const objectUrl = URL.createObjectURL(image)
  try {
    const img = await loadImage(objectUrl)
    const c = createCanvas()
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('canvas 不支援')
    ctx.drawImage(img, 0, 0, SIZE, SIZE)

    const { margin, cardW, cardH, qr, radius } = QR_LAYOUT
    const x = SIZE - margin - cardW
    const y = SIZE - margin - cardH
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.25)'
    ctx.shadowBlur = 16
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, x, y, cardW, cardH, radius)
    ctx.fill()
    ctx.restore()
    ctx.drawImage(qrCanvas, x + (cardW - qr) / 2, y + 16, qr, qr)
    ctx.fillStyle = '#30383D'
    ctx.font = '600 28px "PingFang TC","Noto Sans TC",sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('掃我看政策', x + cardW / 2, y + 16 + qr + 22)
    return await canvasToBlob(c)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
