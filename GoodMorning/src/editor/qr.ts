/**
 * 下載圖合成政策 QR Code（US-09）。
 * 正式環境由後端合成；此檔供 mock 模式使用，也是給後端參考的版面規格：
 *   - 位置：右下角，距邊 28px
 *   - 白底圓角卡 260 × 320、圓角 24、外框 6px TownPass Primary/500（#5AB4C5）
 *   - QR 220 × 220（含 quiet zone 2 模組），錯誤修正等級 M，距卡片上緣 20px
 *   - 下方一列：台北通 logo 36px（官方 logo_S）＋「掃我看政策」28px Grey/800，置中
 */
import { SIZE } from './layout'
import { canvasToBlob, createCanvas, loadImage } from './render'
import { drawTownPassLogo } from './townpassLogo'

export const QR_LAYOUT = { margin: 28, cardW: 260, cardH: 320, qr: 220, radius: 24, border: 6, logo: 36 }

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

    const { margin, cardW, cardH, qr, radius, border, logo } = QR_LAYOUT
    const x = SIZE - margin - cardW
    const y = SIZE - margin - cardH
    // 白卡＋陰影
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.25)'
    ctx.shadowBlur = 16
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, x, y, cardW, cardH, radius)
    ctx.fill()
    ctx.restore()
    // TownPass 主色外框
    ctx.save()
    ctx.lineWidth = border
    ctx.strokeStyle = '#5ab4c5'
    roundRect(ctx, x + border / 2, y + border / 2, cardW - border, cardH - border, radius - border / 2)
    ctx.stroke()
    ctx.restore()
    // QR
    ctx.drawImage(qrCanvas, x + (cardW - qr) / 2, y + 20, qr, qr)
    // 下方：logo ＋ 文字，整列置中
    ctx.font = '600 28px "PingFang TC","Noto Sans TC",sans-serif'
    const label = '掃我看政策'
    const gap = 8
    const textW = ctx.measureText(label).width
    const rowW = logo + gap + textW
    const rowX = x + (cardW - rowW) / 2
    const rowY = y + 20 + qr + (cardH - 20 - qr - border) / 2
    drawTownPassLogo(ctx, rowX, rowY - logo / 2, logo)
    ctx.fillStyle = '#30383d'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, rowX + logo + gap, rowY + 1)
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
