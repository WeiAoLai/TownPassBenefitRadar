import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BADGES, BADGE_ART_FILES } from '../src/config/badges'

describe('徽章大圖', () => {
  it('設定的每個檔案都存在於 public/badges/', () => {
    for (const file of Object.values(BADGE_ART_FILES)) {
      expect(existsSync(new URL(`../public/badges/${file}`, import.meta.url)), file).toBe(true)
    }
  })
  it('只對應到存在的等級', () => {
    const levels = new Set<number>(BADGES.map((b) => b.level))
    for (const level of Object.keys(BADGE_ART_FILES)) expect(levels.has(Number(level)), `Lv.${level}`).toBe(true)
  })
})
