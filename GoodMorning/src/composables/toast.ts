import { nextTick, ref } from 'vue'

export interface ToastMsg {
  id: number
  text: string
  kind: 'info' | 'success' | 'error'
}

export const toasts = ref<ToastMsg[]>([])
let seq = 0

/**
 * 非阻斷式提示（role=status / alert）。長輩閱讀需要較長時間：一般 7 秒；
 * 錯誤不會自己消失，要點一下才關閉（台北通 DC／NT：限時內容要能控制，錯誤訊息不能來不及看就不見）。
 * 呼叫端不要再傳更短的秒數；特別需要久一點才傳 ms。
 */
export const TOAST_MS = { normal: 7000 }

export function toast(text: string, kind: ToastMsg['kind'] = 'info', ms?: number) {
  const id = ++seq
  toasts.value = [...toasts.value.slice(-1), { id, text, kind }]
  const dur = ms ?? (kind === 'error' ? null : TOAST_MS.normal)
  if (dur != null) setTimeout(() => dismiss(id), dur)
}

export function dismiss(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

/**
 * 給讀報軟體的狀態播報（例如「載入中」）。文字寫進 ToastHost 裡一直存在的 role=status 區域，
 * 不需要在畫面上顯示。先清空再寫入，同樣的文字也會重新播報。
 */
export const liveMessage = ref('')
export async function announce(text: string) {
  liveMessage.value = ''
  await nextTick()
  liveMessage.value = text
}
