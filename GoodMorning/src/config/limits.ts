/**
 * 每人每天最多製作幾張長輩圖。
 * 「一天」以台北時間（UTC+8，無日光節約）00:00 為界，跟手機時區無關。
 * 正式版必須由後端擋（見 README「每日製作上限」）；前端只負責提示與 mock。
 */
export const DAILY_ARTWORK_LIMIT = 3

/** 業務錯誤碼：超過每日上限（HTTP 429） */
export const DAILY_LIMIT_CODE = 'DAILY_LIMIT_REACHED'

const TAIPEI_OFFSET_MS = 8 * 3600_000

/** ISO 時間或 Date 換算成台北日期 YYYY-MM-DD */
export function taipeiDay(t: string | Date | number): string {
  const ms = typeof t === 'number' ? t : new Date(t).getTime()
  return new Date(ms + TAIPEI_OFFSET_MS).toISOString().slice(0, 10)
}

/** 這些時間裡，有幾筆落在「今天」（台北時間） */
export function countToday(createdAts: string[], now: Date | number = Date.now()): number {
  const today = taipeiDay(now)
  return createdAts.filter((c) => taipeiDay(c) === today).length
}

/** 距離台北時間明天 00:00 還有幾小時（無條件進位，至少 1） */
export function hoursUntilReset(now: Date | number = Date.now()): number {
  const ms = typeof now === 'number' ? now : now.getTime()
  const local = ms + TAIPEI_OFFSET_MS
  const nextMidnight = Math.floor(local / 86_400_000 + 1) * 86_400_000
  return Math.max(1, Math.ceil((nextMidnight - local) / 3_600_000))
}
