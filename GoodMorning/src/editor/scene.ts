import type { TextLayer } from './layout'

/** 圖層 0 = 問候語、圖層 1 = 政策標語 */
export const GREETING = 0
export const SLOGAN = 1

export function defaultLayers(
  greeting = '早安',
  slogan = '',
  greetingStyle = 'red-orange',
  sloganStyle = 'gold-blue',
): TextLayer[] {
  return [
    { text: greeting, x: 0.84, y: 0.34, size: 180, vertical: true, styleId: greetingStyle, font: 'sans' },
    { text: slogan, x: 0.42, y: 0.6, size: 92, vertical: false, styleId: sloganStyle, font: 'sans' },
  ]
}

/** 九宮格快速定位（拖曳以外的單指操作替代方案） */
export const POSITIONS: { label: string; x: number; y: number }[] = [
  { label: '左上', x: 0.2, y: 0.18 },
  { label: '上', x: 0.5, y: 0.18 },
  { label: '右上', x: 0.8, y: 0.18 },
  { label: '左', x: 0.2, y: 0.5 },
  { label: '中', x: 0.5, y: 0.5 },
  { label: '右', x: 0.8, y: 0.5 },
  { label: '左下', x: 0.2, y: 0.72 },
  { label: '下', x: 0.5, y: 0.72 },
  { label: '右下', x: 0.8, y: 0.72 },
]
