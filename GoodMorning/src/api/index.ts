import { ref } from 'vue'
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

const getUser = () => demoUser.value

let mockPromise: Promise<Api> | null = null
const loadMock = () => (mockPromise ??= import('./mock').then((m) => m.createMockApi(getUser)))

const http = apiMode === 'http' ? createHttpApi(import.meta.env.VITE_API_BASE_URL || '/api', getUser) : null

/** mock 模式延遲載入，正式 bundle 不會帶入 mock 與 QR 合成程式 */
export const api: Api = new Proxy({} as Api, {
  get(_t, prop: keyof Api) {
    return async (...args: unknown[]) => {
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
