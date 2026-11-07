import { describe, expect, it } from 'vitest'
import { countToday, hoursUntilReset, taipeiDay } from '../src/config/limits'

describe('每日製作上限（台北時間）', () => {
  it('台北時間跨日以 00:00 為界，不是 UTC', () => {
    // UTC 15:59 = 台北 23:59；UTC 16:00 = 台北隔天 00:00
    expect(taipeiDay('2026-11-07T15:59:00Z')).toBe('2026-11-07')
    expect(taipeiDay('2026-11-07T16:00:00Z')).toBe('2026-11-08')
  })

  it('只計算今天的作品', () => {
    const now = new Date('2026-11-08T02:00:00Z') // 台北 11/8 10:00
    const times = [
      '2026-11-08T01:00:00Z', // 台北 11/8 09:00 ✓
      '2026-11-07T16:30:00Z', // 台北 11/8 00:30 ✓
      '2026-11-07T15:30:00Z', // 台北 11/7 23:30 ✗
      '2026-11-06T02:00:00Z', // ✗
    ]
    expect(countToday(times, now)).toBe(2)
  })

  it('距離重置的小時數', () => {
    expect(hoursUntilReset(new Date('2026-11-07T15:30:00Z'))).toBe(1) // 台北 23:30
    expect(hoursUntilReset(new Date('2026-11-07T16:00:00Z'))).toBe(24) // 台北 00:00
    expect(hoursUntilReset(new Date('2026-11-08T02:00:00Z'))).toBe(14) // 台北 10:00
  })
})
