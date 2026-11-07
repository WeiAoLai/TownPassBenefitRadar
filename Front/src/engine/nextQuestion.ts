import type { Evaluation, FieldKey } from './types'

/** 回答成本：是非題最輕鬆，選區間次之，填確切數字最累 */
function cost(key: FieldKey): number {
  if (key.endsWith('Exact') || key.endsWith(':age')) return 2.5
  if (/:(income|movable|realEstate|noWork)$/.test(key)) return 1.3
  return 1
}

/**
 * 選下一題：每個「還不確定」的方案列出它需要的欄位；
 * 欄位分數＝依賴它的方案重要性（金額權重）加總 ÷ 回答成本，選最高的。
 * 已經判定符合或不符合的方案不再貢獻分數，所以不會問用不到的題目。
 * 純計算，沒有模型；幾十個欄位在任何手機上都是毫秒以內。
 */
export function nextQuestion(ev: Evaluation, skipped: ReadonlySet<FieldKey>): FieldKey | null {
  const score = new Map<FieldKey, number>()
  for (const r of ev.results) {
    if (r.status !== 'maybe') continue
    for (const k of r.needs) {
      if (skipped.has(k)) continue
      score.set(k, (score.get(k) ?? 0) + r.weight)
    }
  }
  let best: FieldKey | null = null
  let bestScore = -Infinity
  for (const [k, s] of score) {
    const adj = s / cost(k)
    if (adj > bestScore) {
      best = k
      bestScore = adj
    }
  }
  return best
}

/** 這題會影響哪些方案（給畫面顯示「為什麼問這題」） */
export function affects(ev: Evaluation, key: FieldKey): string[] {
  return ev.results.filter((r) => r.status === 'maybe' && r.needs.includes(key)).map((r) => r.name)
}
