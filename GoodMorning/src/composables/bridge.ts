/**
 * TownPass App 橋接（taipei-doit/TownPass web_message_handler）。
 *   網頁 → App：flutterObject.postMessage(JSON.stringify({ name, data }))
 * 本服務只用 open_link（無成功回覆的方法），不需要註冊回覆監聽。
 * 一般瀏覽器沒有 flutterObject，自動退回瀏覽器做法。
 */
declare global {
  interface Window {
    flutterObject?: {
      postMessage(message: string): void
    }
  }
}

export const inTownPass = (): boolean => typeof window !== 'undefined' && typeof window.flutterObject?.postMessage === 'function'

export function openLink(url: string) {
  if (!/^https:\/\//.test(url)) return
  if (inTownPass()) window.flutterObject!.postMessage(JSON.stringify({ name: 'open_link', data: url }))
  else window.open(url, '_blank', 'noopener')
}
