/**
 * 動畫效果開關（台北通 DC：使用者能控制動態內容；NCC 1.3：自動模式要有手動切換）。
 * 沒選過時跟著系統「減少動態」設定；使用者在「我的 › 設定」手動切換後，以手動選擇為準並記在這支手機上。
 * 實際停止動畫的樣式在 css/base.css（html[data-motion]）。
 */
import { ref } from 'vue'

const KEY = 'good-morning.motion'

function systemPrefersReduced(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function readPref(): boolean | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'on' ? true : v === 'off' ? false : null
  } catch {
    return null
  }
}

/** true = 播放動畫 */
export const motionOn = ref(readPref() ?? !systemPrefersReduced())

function apply() {
  document.documentElement.dataset.motion = motionOn.value ? 'on' : 'off'
}

/** 啟動時呼叫一次（main.ts） */
export function initMotion() {
  apply()
}

export function setMotion(on: boolean) {
  motionOn.value = on
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* 無痕模式等：這次有效就好 */
  }
  apply()
}
