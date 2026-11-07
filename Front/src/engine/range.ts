import type { Range, Tri } from './types'

export const exact = (n: number): Range => [n, n]

export function sum(ranges: Range[]): Range {
  return ranges.reduce<Range>((acc, r) => [acc[0] + r[0], acc[1] + r[1]], [0, 0])
}

export function div(r: Range, n: number): Range {
  return [r[0] / n, r[1] / n]
}

/** 必須「低於」上限（嚴格小於） */
export function below(r: Range, cap: number): Tri {
  if (r[1] < cap) return 'pass'
  if (r[0] >= cap) return 'fail'
  return 'unknown'
}

/** 「不超過」上限（小於等於） */
export function atMost(r: Range, cap: number): Tri {
  if (r[1] <= cap) return 'pass'
  if (r[0] > cap) return 'fail'
  return 'unknown'
}

export function and(tris: Tri[]): Tri {
  if (tris.includes('fail')) return 'fail'
  if (tris.includes('unknown')) return 'unknown'
  return 'pass'
}

const fmt = new Intl.NumberFormat('zh-TW')

export function money(n: number): string {
  if (!isFinite(n)) return '不限'
  return `${fmt.format(Math.round(n))} 元`
}

/** 大金額用「萬」 */
export function wan(n: number): string {
  if (!isFinite(n)) return '以上'
  const w = n / 10000
  return `${Number.isInteger(w) ? w : w.toFixed(1)} 萬`
}

export function rangeText(r: Range, unit: (n: number) => string = money): string {
  if (r[0] === r[1]) return `約 ${unit(r[0])}`
  if (!isFinite(r[1])) return `${unit(r[0])}以上`
  return `${unit(r[0])}～${unit(r[1])}`
}
