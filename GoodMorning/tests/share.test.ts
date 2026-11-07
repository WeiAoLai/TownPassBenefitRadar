import { describe, expect, it } from 'vitest'
import { shareMessage } from '../src/composables/share'
import { CELEBRATION_SECONDS } from '../src/composables/sound'

describe('分享文字', () => {
  it('拿到徽章時寫明等級與名稱，結尾是冒號（後面直接接連結）', () => {
    const t = shareMessage({ level: 2, name: '雙喜分享' })
    expect(t).toContain('Lv.2 雙喜分享')
    expect(t).toContain('早安政策圖')
    expect(t.endsWith('：')).toBe(true)
  })
  it('沒有徽章時也是完整的一句邀請', () => {
    const t = shareMessage(null)
    expect(t).toContain('早安政策圖')
    expect(t.endsWith('：')).toBe(true)
  })
})

describe('慶祝音效', () => {
  it('整段不超過 4 秒（長輩不會被一直吵）', () => {
    expect(CELEBRATION_SECONDS).toBeGreaterThan(2)
    expect(CELEBRATION_SECONDS).toBeLessThanOrEqual(4)
  })
})
