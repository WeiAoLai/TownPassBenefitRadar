import { ref } from 'vue'

export interface ToastMsg {
  id: number
  text: string
  kind: 'info' | 'success' | 'error'
}

export const toasts = ref<ToastMsg[]>([])
let seq = 0

/**
 * 非阻斷式提示（role=status / alert）。長輩閱讀需要較長時間：一般 7 秒、錯誤 10 秒（原本 4 秒），隨時可點一下關閉。
 * 呼叫端不要再傳更短的秒數；特別需要久一點才傳 ms。
 */
export const TOAST_MS = { normal: 7000, error: 10000 }

export function toast(text: string, kind: ToastMsg['kind'] = 'info', ms?: number) {
  const id = ++seq
  toasts.value = [...toasts.value.slice(-1), { id, text, kind }]
  setTimeout(() => dismiss(id), ms ?? (kind === 'error' ? TOAST_MS.error : TOAST_MS.normal))
}

export function dismiss(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}
