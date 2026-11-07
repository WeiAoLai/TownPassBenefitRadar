/**
 * 自己的照片當背景：只在這支手機裡處理，不另外上傳原圖。
 * 先裁成正方形、縮到 1080（長輩圖輸出尺寸），省記憶體，也把相片的 EXIF（拍攝地點等）留在原檔裡。
 * 照片只活在記憶體；重新整理頁面後要再選一次。
 */
import { shallowRef } from 'vue'
import { SIZE } from './layout'

export interface CustomPhoto {
  canvas: HTMLCanvasElement
  /** 縮圖網址，給背景面板顯示 */
  thumb: string
}

export const customPhoto = shallowRef<CustomPhoto | null>(null)

/** 手機照片上限：超過就請使用者換一張，避免舊手機記憶體不足閃退 */
export const MAX_PHOTO_BYTES = 30 * 1024 * 1024

function decode(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('decode'))
    }
    img.src = url
  })
}

/** 讀取使用者挑的照片；瀏覽器會依 EXIF 轉正方向 */
export async function loadCustomPhoto(file: File): Promise<CustomPhoto> {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name)) throw new Error('type')
  if (file.size > MAX_PHOTO_BYTES) throw new Error('size')
  const img = await decode(file)
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  if (!iw || !ih) throw new Error('decode')

  const side = Math.min(iw, ih)
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('decode')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, (iw - side) / 2, (ih - side) / 2, side, side, 0, 0, SIZE, SIZE)

  const t = document.createElement('canvas')
  t.width = 240
  t.height = 240
  t.getContext('2d')?.drawImage(canvas, 0, 0, 240, 240)
  return { canvas, thumb: t.toDataURL('image/jpeg', 0.8) }
}

export function photoErrorMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : ''
  if (m === 'size') return '照片太大了（超過 30 MB），請換一張'
  if (m === 'type') return '只能用照片檔（JPG、PNG、HEIC）'
  return '這張照片打不開，請換一張試試'
}
