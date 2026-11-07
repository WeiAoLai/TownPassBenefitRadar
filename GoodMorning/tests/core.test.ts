import { describe, expect, it } from 'vitest'
import { BADGES, badgeFor, leaderboardScore, nextBadge, rankArtworks } from '../src/config/badges'
import { SIZE, columnsVertical, layoutLayer, tokenize, wrapHorizontal, type TextLayer } from '../src/editor/layout'

/** 等寬量測：每個字寬 = 字級（中文字近似值） */
const mono = (t: string, fs: number) => [...t].length * fs

describe('排行榜（US-06）', () => {
  it('分數取愛心與下載的較高值，範例排名 B、A、C', () => {
    const items = [
      { id: 'A', likeCount: 80, downloadCount: 35, createdAt: '2026-11-01' },
      { id: 'B', likeCount: 20, downloadCount: 95, createdAt: '2026-11-02' },
      { id: 'C', likeCount: 60, downloadCount: 60, createdAt: '2026-11-03' },
    ]
    expect(items.map(leaderboardScore)).toEqual([80, 95, 60])
    expect(rankArtworks(items).map((r) => r.artwork.id)).toEqual(['B', 'A', 'C'])
  })

  it('同分用 competition ranking（1、2、2、4），同分新作品在前', () => {
    const items = [
      { id: 1, likeCount: 10, downloadCount: 0, createdAt: '2026-11-01T00:00:00Z' },
      { id: 2, likeCount: 5, downloadCount: 7, createdAt: '2026-11-01T01:00:00Z' },
      { id: 3, likeCount: 7, downloadCount: 1, createdAt: '2026-11-02T00:00:00Z' },
      { id: 4, likeCount: 1, downloadCount: 2, createdAt: '2026-11-03T00:00:00Z' },
    ]
    const r = rankArtworks(items)
    expect(r.map((x) => [x.artwork.id, x.rank])).toEqual([
      [1, 1],
      [3, 2],
      [2, 2],
      [4, 4],
    ])
  })

  it('最多回傳 100 筆', () => {
    const many = Array.from({ length: 130 }, (_, i) => ({ likeCount: i, downloadCount: 0, createdAt: String(i) }))
    expect(rankArtworks(many)).toHaveLength(100)
  })
})

describe('徽章（US-07）', () => {
  it('十級門檻為 2^(n-1)', () => {
    expect(BADGES.map((b) => b.threshold)).toEqual(BADGES.map((b) => 2 ** (b.level - 1)))
  })
  it('未達門檻不升級', () => {
    expect(badgeFor(0)).toBeNull()
    expect(badgeFor(1)?.level).toBe(1)
    expect(badgeFor(3)?.level).toBe(2)
    expect(badgeFor(4)?.level).toBe(3)
    expect(badgeFor(511)?.level).toBe(9)
    expect(badgeFor(9999)?.level).toBe(10)
    expect(nextBadge(4)?.threshold).toBe(8)
    expect(nextBadge(512)).toBeNull()
  })
})

describe('文字排版', () => {
  const base: TextLayer = { text: '', x: 0.5, y: 0.5, size: 100, vertical: false, styleId: 'gold-blue', font: 'sans' }

  it('英數字不被拆開', () => {
    expect(tokenize('撥打165查證')).toEqual(['撥', '打', '165', '查', '證'])
  })

  it('橫書自動換行且標點不放行首', () => {
    const lines = wrapHorizontal('一二三四，五六', 100, 400, mono)
    expect(lines[0]).toBe('一二三四，')
    expect(lines[1]).toBe('五六')
  })

  it('直書轉換直排標點並分欄', () => {
    const cols = columnsVertical('早安，你好\n平安', 3)
    expect(cols[0]).toEqual(['早', '安', '︐'])
    expect(cols[1]).toEqual(['你', '好'])
    expect(cols[2]).toEqual(['平', '安'])
  })

  it('長標語自動縮小並維持在畫布內', () => {
    const l = layoutLayer({ ...base, text: '長'.repeat(200), size: 200 }, mono)
    expect(l.fontSize).toBeLessThan(200)
    expect(l.box.x).toBeGreaterThanOrEqual(0)
    expect(l.box.y).toBeGreaterThanOrEqual(0)
    expect(l.box.x + l.box.w).toBeLessThanOrEqual(SIZE + 0.01)
    expect(l.box.y + l.box.h).toBeLessThanOrEqual(SIZE + 0.01)
  })

  it('拖到邊緣時文字框被夾回畫布內', () => {
    const l = layoutLayer({ ...base, text: '早安', x: 1, y: 0, vertical: true, size: 200 }, mono)
    expect(l.box.x + l.box.w).toBeLessThanOrEqual(SIZE + 0.01)
    expect(l.box.y).toBeGreaterThanOrEqual(0)
  })

  it('空字串不產生字形', () => {
    expect(layoutLayer({ ...base, text: '   ' }, mono).glyphs).toHaveLength(0)
  })

  it('500 字也排得進畫布', () => {
    const l = layoutLayer({ ...base, text: '政策'.repeat(250), size: 120 }, mono)
    expect(l.glyphs.length).toBeGreaterThan(0)
    expect(l.box.y + l.box.h).toBeLessThanOrEqual(SIZE + 0.01)
  })
})
