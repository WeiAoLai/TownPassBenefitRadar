import { existsSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { VOICE_FILES, VOICE_MAX_GAIN, VOICE_MAX_PEAK, VOICE_TARGET_RMS, analyzeSamples, pickVoice } from '../src/composables/sound'

/** 產生一段測試錄音：前後靜音，中間是固定振幅的方波（有聲音部分 RMS = 振幅） */
function clip(sampleRate: number, silenceSec: number, voiceSec: number, amp: number) {
  const s = Math.round(silenceSec * sampleRate)
  const v = Math.round(voiceSec * sampleRate)
  const d = new Float32Array(s + v + s)
  for (let i = 0; i < v; i++) d[s + i] = i % 2 ? amp : -amp
  return d
}

describe('稱讚錄音檔', () => {
  it('VOICE_FILES 列的每個檔案都存在、不是空檔', () => {
    for (const f of VOICE_FILES) {
      const url = new URL(`../public/sounds/${f}`, import.meta.url)
      expect(existsSync(url), f).toBe(true)
      expect(statSync(url).size, f).toBeGreaterThan(1000)
    }
  })
})

describe('音量平衡 analyzeSamples', () => {
  it('小聲的錄音放大到目標音量', () => {
    const r = analyzeSamples(clip(48000, 0.5, 1, 0.05), 48000)
    expect(r.gain).toBeCloseTo(VOICE_TARGET_RMS / 0.05, 5)
  })
  it('大聲的錄音縮小到目標音量', () => {
    const r = analyzeSamples(clip(48000, 0.5, 1, 0.5), 48000)
    expect(r.gain).toBeCloseTo(VOICE_TARGET_RMS / 0.5, 5)
  })
  it('放大後的峰值不會超過上限（避免爆音）', () => {
    // 有聲音部分很小聲，但夾一個很大的尖峰
    const d = clip(48000, 0.2, 1, 0.03)
    d[48000] = 0.9
    const r = analyzeSamples(d, 48000)
    // Float32Array 存的是 32 位元浮點數，尖峰要用同樣的精度比
    expect(Math.fround(0.9) * r.gain).toBeLessThanOrEqual(VOICE_MAX_PEAK + 1e-9)
  })
  it('極小聲也不會無限放大', () => {
    expect(analyzeSamples(clip(48000, 0.2, 1, 0.025), 48000).gain).toBeLessThanOrEqual(VOICE_MAX_GAIN)
  })
  it('去掉前後的靜音，保留一點餘裕', () => {
    const r = analyzeSamples(clip(48000, 0.5, 1, 0.3), 48000)
    expect(r.start).toBeGreaterThan(0.4)
    expect(r.start).toBeLessThan(0.5)
    expect(r.dur).toBeGreaterThan(1)
    expect(r.dur).toBeLessThan(1.3)
  })
  it('整段都是靜音時不調整、不去頭尾', () => {
    const r = analyzeSamples(new Float32Array(48000), 48000)
    expect(r).toEqual({ gain: 1, start: 0, dur: 1 })
  })
})

describe('隨機挑一句', () => {
  it('沒有錄音檔時回傳 null', () => {
    expect(pickVoice([])).toBeNull()
  })
  it('只有一句就是那一句', () => {
    expect(pickVoice(['a.m4a'], () => 0.99)).toBe('a.m4a')
  })
  it('三句都有機會被挑到，而且不會連續兩次同一句', () => {
    const files = ['a.m4a', 'b.m4a', 'c.m4a']
    const seen = new Set<string>()
    let prev: string | null = null
    for (let i = 0; i < 300; i++) {
      const f = pickVoice(files)!
      expect(f).not.toBe(prev)
      seen.add(f)
      prev = f
    }
    expect(seen.size).toBe(3)
  })
})
