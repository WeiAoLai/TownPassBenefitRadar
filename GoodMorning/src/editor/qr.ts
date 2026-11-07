/**
 * 下載圖合成政策 QR Code（US-09）。
 * 正式環境由後端合成；此檔供 mock 模式使用，也是給後端參考的版面規格：
 *   - 位置：右下角，距邊 28px
 *   - 白底圓角卡 260 × 296、圓角 24、外框 6px TownPass Primary/500（#5AB4C5）
 *   - 卡片內：QR 220 × 220（含 quiet zone 2 模組，錯誤修正等級 M，距卡片上緣 20px）＋「掃我看政策」28px Grey/800（中心距卡片上緣 264px），置中
 *   - 卡片外、正下方 44px 高的一列：台北通 logo 36px（官方 logo_S，白色圓底）＋作品日期 YYYY.MM.DD（台北時間）
 *     24px 白字黑邊，整列對齊卡片中線。整個區塊（卡片＋下方一列）離右、下邊各 28px
 */
import { SIZE } from './layout'
import { canvasToBlob, createCanvas, loadImage } from './render'
import { drawTownPassLogo } from './townpassLogo'
import { taipeiDay } from '../config/limits'

export const QR_LAYOUT = { margin: 28, cardW: 260, cardH: 296, footer: 44, qr: 220, radius: 24, border: 6, logo: 36 }

/** 整個 QR 區塊（卡片＋下方 logo 與日期）的位置，編輯器預覽的虛線框也用這個 */
export function qrZone() {
  const { margin, cardW, cardH, footer } = QR_LAYOUT
  const h = cardH + footer
  return { x: SIZE - margin - cardW, y: SIZE - margin - h, w: cardW, h }
}

/** QR 卡片上的日期：台北時間 YYYY.MM.DD */
export const qrDateLabel = (createdAt: string | Date | number) => taipeiDay(createdAt).replace(/-/g, '.')

/** createdAt：作品建立時間，印在 QR 下方；省略時不印日期 */
export async function composeWithQr(image: Blob, url: string, createdAt?: string): Promise<Blob> {
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

    const { cardW, cardH, footer, qr, radius, border, logo } = QR_LAYOUT
    const { x, y } = qrZone()
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
    // 卡片內：「掃我看政策」
    ctx.font = '600 28px "PingFang TC","Noto Sans TC",sans-serif'
    ctx.fillStyle = '#30383d'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('掃我看政策', x + cardW / 2, y + 20 + qr + 24)

    // 卡片外：台北通 logo ＋ 日期，壓在照片上（白色圓底 logo、白字黑邊，任何背景都看得清楚）
    const rowY = y + cardH + footer / 2 + 2
    const dateText = createdAt ? qrDateLabel(createdAt) : ''
    ctx.font = '700 24px "PingFang TC","Noto Sans TC",sans-serif'
    const gap = dateText ? 10 : 0
    const dateW = dateText ? ctx.measureText(dateText).width : 0
    const rowX = x + (cardW - (logo + gap + dateW)) / 2
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.3)'
    ctx.shadowBlur = 6
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(rowX + logo / 2, rowY, logo / 2 + 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    drawTownPassLogo(ctx, rowX + 4, rowY - logo / 2 + 4, logo - 8)
    if (dateText) {
      ctx.save()
      ctx.textAlign = 'left'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 5
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'
      ctx.strokeText(dateText, rowX + logo + gap, rowY + 1)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(dateText, rowX + logo + gap, rowY + 1)
      ctx.restore()
    }
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
