/**
 * 獲得徽章的慶祝音效 = 現場合成的歡樂音效（Web Audio，不需要音檔） + 隨機一句真人稱讚（public/sounds/）。
 *
 * 注意：
 * - 預設開啟（產品決定）。這跟台北通無障礙 AV「不自動播放聲音」有出入，所以：聲音只在使用者自己按了
 *   「儲存作品」或「看慶祝動畫」之後才播、右上角與「我的 › 設定」都能關、關閉後記在這支手機上、
 *   關掉慶祝畫面時聲音會立刻淡出。README 的無障礙對照表有註明這個偏離。
 * - 瀏覽器規定要「點過畫面」才能出聲，所以觸發慶祝的按鈕（儲存作品、看慶祝動畫）要在點擊當下先呼叫 unlockAudio()。
 * - iPhone 側邊靜音開關打開時，網頁聲音會被靜音，這是手機的規則。
 * - 稱讚錄音的音量不一，載入時會自動量測、調成一樣大，並去掉前後的靜音（analyzeSamples）；
 *   想換錄音或新增：把檔案放進 public/sounds/，在 VOICE_FILES 加一行即可。
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

/** 音效開關：預設開；使用者關掉後記在這支手機上（儲存空間不能用時只在這次有效） */
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

/** 在使用者點擊的當下呼叫，解開瀏覽器的自動播放限制（之後非點擊觸發的播放才不會被擋），並先把稱讚錄音載好 */
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
  for (const f of VOICE_FILES) void loadVoice(f)
}

/* ---------------- 合成音效 ---------------- */

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

/** 合成音效長度（秒）；稱讚錄音另外算 */
export const CELEBRATION_SECONDS = 3.5
/** 徽章落定、號角響起的時間點（秒，從開始算）；稱讚也在這一刻接著播 */
export const LAND_AT = 1.75

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
 * 排程整段合成音效（可用 OfflineAudioContext 渲染來檢查音量與長度）：
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

  const land = t0 + LAND_AT
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

/* ---------------- 真人稱讚錄音 ---------------- */

/**
 * 慶祝時隨機挑一句（public/sounds/）：
 *   nice.m4a「不錯喔」、amazing.m4a「你怎麼那麼厲害」、beautiful.m4a「這張真的很漂亮欸」
 */
export const VOICE_FILES: readonly string[] = ['nice.m4a', 'amazing.m4a', 'beautiful.m4a']

/** 稱讚的目標音量（有聲音部分的 RMS，約 −16.5 dBFS）、單句最大峰值與最大放大倍率；覺得人聲太大或太小就調這個 */
export const VOICE_TARGET_RMS = 0.15
export const VOICE_MAX_PEAK = 0.85
export const VOICE_MAX_GAIN = 4
/** 大於這個振幅才算「有聲音」（用來量音量、去掉前後靜音） */
const ACTIVE = 0.02
/** 稱讚播放時，合成音效降到這個比例，人聲才聽得清楚；覺得號角太小聲就調大（1 = 不降） */
export const SYNTH_DUCK = 0.8
const SYNTH_LEVEL = 1.1

export interface VoiceClip {
  buffer: AudioBuffer
  /** 調成一樣大聲所需的增益 */
  gain: number
  /** 去掉前面靜音後的起點（秒）與長度（秒） */
  start: number
  dur: number
}

/**
 * 量一段錄音：有聲音部分的音量（RMS）、峰值、前後靜音。
 * 回傳把它調到 VOICE_TARGET_RMS 所需的增益（不超過峰值上限與最大倍率），以及去掉前後靜音後的起點與長度。
 */
export function analyzeSamples(data: ArrayLike<number>, sampleRate: number) {
  let peak = 0
  let sum = 0
  let n = 0
  let first = -1
  let last = -1
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i])
    if (a > peak) peak = a
    if (a > ACTIVE) {
      sum += a * a
      n++
      if (first < 0) first = i
      last = i
    }
  }
  const total = data.length / sampleRate
  if (first < 0 || n === 0 || peak === 0) return { gain: 1, start: 0, dur: total }
  const rms = Math.sqrt(sum / n)
  const gain = Math.min(VOICE_TARGET_RMS / rms, VOICE_MAX_PEAK / peak, VOICE_MAX_GAIN)
  const start = Math.max(0, first / sampleRate - 0.05)
  const end = Math.min(total, (last + 1) / sampleRate + 0.15)
  return { gain, start, dur: end - start }
}

const voices = new Map<string, Promise<VoiceClip | null>>()

/** 下載並解碼一句錄音（失敗回傳 null，慶祝照常進行只是沒有人聲；成功的結果會快取） */
function loadVoice(file: string): Promise<VoiceClip | null> {
  const hit = voices.get(file)
  if (hit) return hit
  const c = getCtx()
  if (!c) return Promise.resolve(null)
  const p = (async () => {
    try {
      const res = await fetch(new URL(`sounds/${file}`, document.baseURI).href)
      if (!res.ok) return null
      const buffer = await c.decodeAudioData(await res.arrayBuffer())
      return { buffer, ...analyzeSamples(buffer.getChannelData(0), buffer.sampleRate) }
    } catch {
      return null
    }
  })()
  voices.set(file, p)
  void p.then((v) => {
    if (!v) voices.delete(file) // 失敗的不快取，下次再試
  })
  return p
}

let lastVoice = -1
/** 隨機挑一句，盡量不連續兩次同一句 */
export function pickVoice(files: readonly string[] = VOICE_FILES, rand: () => number = Math.random): string | null {
  if (!files.length) return null
  let i = Math.floor(rand() * files.length)
  if (files.length > 1 && i === lastVoice) i = (i + 1 + Math.floor(rand() * (files.length - 1))) % files.length
  lastVoice = i
  return files[i]
}

/** 排程一句稱讚（可用 OfflineAudioContext 渲染來檢查）；同時把合成音效壓小一點 */
export function scheduleVoice(ctx: BaseAudioContext, out: AudioNode, synthBus: GainNode, clip: VoiceClip, when: number) {
  const src = ctx.createBufferSource()
  const g = ctx.createGain()
  src.buffer = clip.buffer
  g.gain.value = clip.gain
  src.connect(g)
  g.connect(out)
  src.start(when, clip.start, clip.dur)
  synthBus.gain.setTargetAtTime(SYNTH_LEVEL * SYNTH_DUCK, Math.max(0, when - 0.15), 0.08)
  return when + clip.dur
}

/** 總輸出：音量上限保護（壓縮器當限幅器），避免合成音效和人聲疊在一起時爆音 */
export function createOutput(ctx: BaseAudioContext) {
  const out = ctx.createGain()
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -6
  limiter.knee.value = 6
  limiter.ratio.value = 12
  limiter.attack.value = 0.003
  limiter.release.value = 0.15
  out.connect(limiter)
  limiter.connect(ctx.destination)
  const synthBus = ctx.createGain()
  synthBus.gain.value = SYNTH_LEVEL
  synthBus.connect(out)
  return { out, synthBus }
}

/* ---------------- 播放 ---------------- */

let playing: { ctx: AudioContext; master: GainNode; timer: number } | null = null

/** 播放慶祝音效（音效關閉、瀏覽器不支援或被擋時不做任何事，不影響畫面） */
export function playCelebration() {
  if (!soundOn.value) return
  const c = getCtx()
  if (!c) return
  stopCelebration()
  if (c.state === 'suspended') c.resume().catch(() => {})
  try {
    const { out, synthBus } = createOutput(c)
    const t0 = c.currentTime + 0.05
    scheduleCelebration(c, synthBus, t0)
    const done = () => {
      if (playing?.master === out) {
        out.disconnect()
        playing = null
      }
    }
    const state = { ctx: c, master: out, timer: window.setTimeout(done, (CELEBRATION_SECONDS + 0.3) * 1000) }
    playing = state

    // 一句稱讚：徽章落定時接著播；錄音還沒載好就等一下（最多 2.5 秒），來不及或載入失敗就只有合成音效
    const file = pickVoice()
    if (file) {
      void Promise.race([loadVoice(file), new Promise<null>((r) => setTimeout(() => r(null), 2500))]).then((clip) => {
        if (!clip || playing?.master !== out) return // 載入失敗，或這段已經被關掉
        const at = t0 + LAND_AT
        const when = Math.max(at, c.currentTime + 0.02)
        if (when - at > 1.5) return // 太晚了就不播，免得跟畫面脫節
        const end = scheduleVoice(c, out, synthBus, clip, when)
        window.clearTimeout(state.timer)
        state.timer = window.setTimeout(done, Math.max(0, end - c.currentTime + 0.4) * 1000)
      })
    }
  } catch {
    /* 聲音失敗不影響畫面 */
  }
}

/** 關閉慶祝畫面或關掉音效時，聲音在 0.12 秒內淡出 */
export function stopCelebration() {
  const p = playing
  if (!p) return
  playing = null
  window.clearTimeout(p.timer)
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
