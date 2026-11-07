import { ref } from 'vue'
import { getTownPassAccount, type TownPassAccount } from '../composables/bridge'
import { createHttpApi } from './http'
import type { Api } from './types'

export const apiMode: 'mock' | 'http' = import.meta.env.VITE_API_MODE === 'http' ? 'http' : 'mock'

export const demoUsers = (import.meta.env.VITE_DEMO_USERS || 'user-a,user-b,user-c')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const KEY = 'gm.demoUser'
function readUser(): string {
  try {
    const v = localStorage.getItem(KEY)
    if (v && demoUsers.includes(v)) return v
  } catch {
    /* 無痕模式等 storage 不可用 */
  }
  return demoUsers[0]
}

/** 目前 Demo 使用者（X-Demo-User） */
export const demoUser = ref(readUser())

export function setDemoUser(account: string) {
  demoUser.value = account
  try {
    localStorage.setItem(KEY, account)
  } catch {
    /* 忽略 */
  }
}

/**
 * 台北通帳號（userinfo）。在台北通裡開啟時以它識別使用者，取代示範帳號；
 * 一般瀏覽器或取不到帳號時維持示範帳號。
 */
export const townPassAccount = ref<TownPassAccount | null>(null)

/** 所有 API 呼叫前先等帳號確認完成，避免先用示範帳號送出請求 */
const sessionReady: Promise<void> = getTownPassAccount()
  .then((a) => {
    townPassAccount.value = a
  })
  .catch(() => {
    /* 取不到帳號就用示範帳號 */
  })

/**
 * mock 模式：台北通帳號直接成為目前使用者。
 * http 模式：openapi v0.1.0 只定義 X-Demo-User，台北通登入要等後端新增對應的驗證方式，
 * 在那之前仍送示範帳號。
 */
const getUser = () => (apiMode === 'mock' && townPassAccount.value ? townPassAccount.value.account : demoUser.value)
const getProfile = () => townPassAccount.value

let mockPromise: Promise<Api> | null = null
const loadMock = () => (mockPromise ??= import('./mock').then((m) => m.createMockApi(getUser, getProfile)))

const http = apiMode === 'http' ? createHttpApi(import.meta.env.VITE_API_BASE_URL || '/api/v1', getUser) : null

/** mock 模式延遲載入，正式 bundle 不會帶入 mock 與 QR 合成程式 */
export const api: Api = new Proxy({} as Api, {
  get(_t, prop: keyof Api) {
    return async (...args: unknown[]) => {
      await sessionReady
      const impl = http ?? (await loadMock())
      return (impl[prop] as (...a: unknown[]) => unknown)(...args)
    }
  },
})

export async function resetMockData() {
  if (apiMode !== 'mock') return
  const m = await import('./mock')
  await m.resetMock()
}
