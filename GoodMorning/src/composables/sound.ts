/**
 * 獲得徽章的慶祝音效：用 Web Audio 現場合成，不需要音檔、沒有授權問題。
 * 想換成自己的音檔：把 playCelebration() 內容換成播放 <audio> 即可，其他程式不用動。
 *
 * 注意：
 * - 瀏覽器規定要「點過畫面」才能出聲，所以觸發慶祝的按鈕（儲存作品、看慶祝動畫）要在點擊當下先呼叫 unlockAudio()。
 * - iPhone 側邊靜音開關打開時，網頁聲音會被靜音，這是手機的規則。
 */
import { ref } from 'vue'

const KEY = 'good-morning.sound'

function readPref(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

/** 音效開關：預設開，記在這支手機上（儲存空間不能用時只在這次有效） */
export const soundOn = ref(readPref())

export function setSound(on: boolean) {
  soundOn.value = on
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* 無痕模式等：這次有效就好 */
  }
  if (!on) stopCelebration()
}

type AudioCtor = typeof AudioContext
let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (ctx) return ctx
  const AC: AudioCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
  if (!AC) return null
  try {
    ctx = new AC()
  } catch {
    ctx = null
  }
  return ctx
}

/** 在使用者點擊的當下呼叫，解開瀏覽器的自動播放限制（之後非點擊觸發的播放才不會被擋） */
export function unlockAudio() {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  try {
    // iOS：點擊當下播一個無聲的極短音，才算真正解鎖
    const src = c.createBufferSource()
    src.buffer = c.createBuffer(1, 1, 22050)
    src.connect(c.destination)
    src.start(0)
  } catch {
    /* 解鎖失敗不影響畫面 */
  }
}

/**
 * 音符頻率（Hz）：刻意放在中高音（最高約 2.1 kHz），避開太尖的高頻，
 * 年長者對很尖的聲音比較聽不清楚。
 */
const C4 = 261.63
const C5 = 523.25
const E5 = 659.25
const G5 = 783.99
const C6 = 1046.5
const E6 = 1318.51
const G6 = 1567.98
const C7 = 2093

/** 整段音效長度（秒），畫面動畫約 1.9 秒轉完、落定 */
export const CELEBRATION_SECONDS = 3.5

interface Note {
  f: number
  at: number
  dur: number
  gain: number
  type?: OscillatorType
}

function note(ctx: BaseAudioContext, out: AudioNode, n: Note) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = n.type ?? 'triangle'
  osc.frequency.setValueAtTime(n.f, n.at)
  g.gain.setValueAtTime(0.0001, n.at)
  g.gain.exponentialRampToValueAtTime(n.gain, n.at + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, n.at + n.dur)
  osc.connect(g)
  g.connect(out)
  osc.start(n.at)
  osc.stop(n.at + n.dur + 0.05)
}

/**
 * 排程整段音效（可用 OfflineAudioContext 渲染來檢查音量與長度）：
 * 1. 0–1.8 秒：徽章轉圈的上升「咻」聲
 * 2. 1.75 秒徽章落定：上行號角 do–mi–sol–高 do，最後一音拉長，疊一個低 do 與高八度柔音
 * 3. 之後三聲閃亮鈴聲
 */
export function scheduleCelebration(ctx: BaseAudioContext, out: AudioNode, t0 = ctx.currentTime) {
  const sweep = ctx.createOscillator()
  const sweepGain = ctx.createGain()
  const lowpass = ctx.createBiquadFilter()
  sweep.type = 'triangle'
  sweep.frequency.setValueAtTime(180, t0)
  sweep.frequency.exponentialRampToValueAtTime(1100, t0 + 1.7)
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 2400
  sweepGain.gain.setValueAtTime(0.0001, t0)
  sweepGain.gain.exponentialRampToValueAtTime(0.14, t0 + 0.8)
  sweepGain.gain.linearRampToValueAtTime(0.14, t0 + 1.5)
  sweepGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8)
  sweep.connect(lowpass)
  lowpass.connect(sweepGain)
  sweepGain.connect(out)
  sweep.start(t0)
  sweep.stop(t0 + 1.9)

  const land = t0 + 1.75
  const fanfare: [number, number][] = [
    [C5, 0],
    [E5, 0.15],
    [G5, 0.3],
    [C6, 0.45],
  ]
  fanfare.forEach(([f, delay], i) => {
    const dur = i === fanfare.length - 1 ? 1.1 : 0.3
    note(ctx, out, { f, at: land + delay, dur, gain: 0.2 })
    note(ctx, out, { f: f * 2, at: land + delay, dur, gain: 0.05, type: 'sine' })
  })
  note(ctx, out, { f: C4, at: land + 0.45, dur: 1.1, gain: 0.18, type: 'sine' })

  const chimes: [number, number][] = [
    [E6, 0.7],
    [G6, 0.9],
    [C7, 1.1],
  ]
  chimes.forEach(([f, delay]) => note(ctx, out, { f, at: land + delay, dur: 0.5, gain: 0.07, type: 'sine' }))
}

let playing: { ctx: AudioContext; master: GainNode } | null = null

/** 播放慶祝音效（音效關閉、瀏覽器不支援或被擋時不做任何事，不影響畫面） */
export function playCelebration() {
  if (!soundOn.value) return
  const c = getCtx()
  if (!c) return
  stopCelebration()
  if (c.state === 'suspended') c.resume().catch(() => {})
  try {
    const master = c.createGain()
    // 以 OfflineAudioContext 渲染檢查：此音量整段最高約 0.45（滿格是 1.0），不會爆音，長輩手機音量小也聽得到
    master.gain.value = 1.1
    master.connect(c.destination)
    scheduleCelebration(c, master, c.currentTime + 0.05)
    playing = { ctx: c, master }
    window.setTimeout(() => {
      if (playing?.master === master) {
        master.disconnect()
        playing = null
      }
    }, (CELEBRATION_SECONDS + 0.3) * 1000)
  } catch {
    /* 聲音失敗不影響畫面 */
  }
}

/** 關閉慶祝畫面或關掉音效時，聲音在 0.12 秒內淡出 */
export function stopCelebration() {
  const p = playing
  if (!p) return
  playing = null
  try {
    const t = p.ctx.currentTime
    p.master.gain.cancelScheduledValues(t)
    p.master.gain.setValueAtTime(p.master.gain.value, t)
    p.master.gain.linearRampToValueAtTime(0.0001, t + 0.12)
    window.setTimeout(() => p.master.disconnect(), 200)
  } catch {
    /* ignore */
  }
}
