/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_API_MODE?: 'mock' | 'http'
  readonly VITE_API_BASE_URL?: string
  readonly VITE_DEMO_USERS?: string
  /** 分享給親友的連結；不設定就用目前網站自己的首頁 */
  readonly VITE_SHARE_URL?: string
}
