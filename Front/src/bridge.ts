/**
 * 台北通 App 橋接（flutter_inappwebview Web Message Listener）。
 * 協定依 taipei-doit/TownPass lib/util/web_message_handler：
 *   網頁 → App：flutterObject.postMessage(JSON.stringify({ name, data }))
 *   App → 網頁：message 事件，event.data 是 JSON 字串 { name, data }
 * 在一般瀏覽器裡沒有 flutterObject，全部自動退回瀏覽器做法。
 */

interface FlutterObject {
  postMessage(msg: string): void
  addEventListener(type: 'message', cb: (e: { data: string }) => void): void
  removeEventListener(type: 'message', cb: (e: { data: string }) => void): void
}

declare global {
  interface Window {
    flutterObject?: FlutterObject
  }
}

export const inTownPass = (): boolean => typeof window !== 'undefined' && !!window.flutterObject

function send(name: string, data: unknown) {
  window.flutterObject?.postMessage(JSON.stringify({ name, data }))
}

function request<T>(name: string, data: unknown = null, timeoutMs = 1500): Promise<T | null> {
  const fo = window.flutterObject
  if (!fo) return Promise.resolve(null)
  return new Promise((resolve) => {
    const done = (v: T | null) => {
      fo.removeEventListener('message', cb)
      clearTimeout(timer)
      resolve(v)
    }
    const cb = (e: { data: string }) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg?.name === name) done(msg.data as T)
      } catch {
        /* 不是給我們的訊息 */
      }
    }
    const timer = setTimeout(() => done(null), timeoutMs)
    fo.addEventListener('message', cb)
    send(name, data)
  })
}

/** 從台北通會員資料的生日（yyyy/mm/dd）算年齡，拿不到就回傳 null */
export async function townPassAge(today = new Date()): Promise<number | null> {
  const info = await request<{ birthday?: string }>('userinfo')
  const m = info?.birthday?.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  let age = today.getFullYear() - y
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age -= 1
  return age
}

export function phoneCall(phone: string) {
  if (inTownPass()) send('phone_call', phone)
  else window.location.href = `tel:${phone}`
}

export function openLink(url: string) {
  if (inTownPass()) send('open_link', url)
  else window.open(url, '_blank', 'noopener')
}
