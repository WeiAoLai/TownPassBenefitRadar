import { ref } from 'vue'

export interface ToastMsg {
  id: number
  text: string
  kind: 'info' | 'success' | 'error'
}

export const toasts = ref<ToastMsg[]>([])
let seq = 0

/** 非阻斷式提示（role=status / alert），顯示 4 秒 */
export function toast(text: string, kind: ToastMsg['kind'] = 'info', ms = 4000) {
  const id = ++seq
  toasts.value = [...toasts.value.slice(-1), { id, text, kind }]
  setTimeout(() => dismiss(id), ms)
}

export function dismiss(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}
