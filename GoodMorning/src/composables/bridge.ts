/**
 * TownPass App 橋接（taipei-doit/TownPass lib/util/web_message_handler）。
 *   網頁 → App：flutterObject.postMessage(JSON.stringify({ name, data }))
 *   App → 網頁：flutterObject 的 message 事件，event.data 是 JSON 字串 { name, data }
 * 一般瀏覽器沒有 flutterObject，各函式自動退回瀏覽器做法或回傳 null。
 * 不在 console 印出任何帳號或位置資料。
 */
type Listener = (event: { data: string }) => void

declare global {
  interface Window {
    flutterObject?: {
      postMessage(message: string): void
      addEventListener?(type: 'message', listener: Listener): void
      removeEventListener?(type: 'message', listener: Listener): void
    }
  }
}

export const inTownPass = (): boolean => typeof window !== 'undefined' && typeof window.flutterObject?.postMessage === 'function'

function send(name: string, data: unknown) {
  window.flutterObject?.postMessage(JSON.stringify({ name, data }))
}

/**
 * 送出會回覆的方法並等待回覆。先註冊監聽再送出；逾時視為「不知道」，回傳 null，不當成原生功能失敗。
 */
function request<T>(name: string, data: unknown = null, timeoutMs = 8000): Promise<T | null> {
  const fo = window.flutterObject
  if (!fo?.addEventListener) return Promise.resolve(null)
  return new Promise((resolve) => {
    let settled = false
    const done = (v: T | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fo.removeEventListener?.('message', onMessage)
      resolve(v)
    }
    const onMessage: Listener = (e) => {
      try {
        const msg = JSON.parse(e.data) as { name?: string; data?: unknown }
        if (msg?.name === name) done((msg.data ?? null) as T | null)
      } catch {
        /* 不是 JSON，或不是給這個請求的訊息 */
      }
    }
    const timer = setTimeout(() => done(null), timeoutMs)
    fo.addEventListener!('message', onMessage)
    send(name, data)
  })
}

export function openLink(url: string) {
  if (!/^https:\/\//.test(url)) return
  if (inTownPass()) send('open_link', url)
  else window.open(url, '_blank', 'noopener')
}

/* ---------------- userinfo：台北通帳號 ---------------- */

export interface TownPassAccount {
  /** 帳號（不公開顯示） */
  account: string
  /** 公開顯示的名稱：用台北通暱稱（username），不用真實姓名 */
  displayName: string
}

/** 取得台北通帳號；不在台北通裡、使用者未登入或逾時都回傳 null */
export async function getTownPassAccount(): Promise<TownPassAccount | null> {
  if (!inTownPass()) return null
  const raw = await request<Record<string, unknown>>('userinfo')
  // App 可能直接回帳號物件，也可能包在 { data } 裡（assets/mock_data/account.json 的格式）
  const info = (raw && typeof raw === 'object' && 'data' in raw ? (raw.data as Record<string, unknown>) : raw) ?? null
  if (!info || typeof info !== 'object') return null
  const username = typeof info.username === 'string' ? info.username.trim() : ''
  const id = typeof info.id === 'string' || typeof info.id === 'number' ? String(info.id) : ''
  const account = username || id
  if (!account) return null
  return { account: `tp-${account}`.slice(0, 64), displayName: (username || '台北通用戶').slice(0, 20) }
}

/* ---------------- location：目前位置 ---------------- */

export interface LatLng {
  lat: number
  lng: number
}

/**
 * 取得目前位置：在台北通裡用 App 的 location，否則用瀏覽器定位。
 * 只在使用者按下按鈕時呼叫；拒絕、不支援或逾時都回傳 null。
 */
export async function getLocation(): Promise<LatLng | null> {
  if (inTownPass()) {
    const d = await request<{ latitude?: number; longitude?: number; lat?: number; lng?: number }>('location', null, 15000)
    const lat = Number(d?.latitude ?? d?.lat)
    const lng = Number(d?.longitude ?? d?.lng)
    return Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng) ? { lat, lng } : null
  }
  if (!('geolocation' in navigator)) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60_000 },
    )
  })
}

/** 兩點距離（公里），haversine */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/* ---------------- daily_reminder：每日提醒（自訂 handler） ---------------- */

export interface ReminderStatus {
  enabled: boolean
  hour?: number
  minute?: number
  /** false = 使用者沒給通知權限 */
  permission?: boolean
}

/** App 有沒有裝 daily_reminder handler：舊版台北通沒裝，request 會逾時回 null */
export async function getDailyReminder(): Promise<ReminderStatus | null> {
  if (!inTownPass()) return null
  return request<ReminderStatus>('daily_reminder', { action: 'status' }, 4000)
}

export async function setDailyReminder(opts: { hour: number; minute: number; title: string; content: string }): Promise<ReminderStatus | null> {
  if (!inTownPass()) return null
  // 點通知直接回到編輯器
  const url = new URL('#/create', location.href).href
  return request<ReminderStatus>('daily_reminder', { action: 'set', ...opts, url }, 15000)
}

export async function cancelDailyReminder(): Promise<ReminderStatus | null> {
  if (!inTownPass()) return null
  return request<ReminderStatus>('daily_reminder', { action: 'cancel' }, 4000)
}
