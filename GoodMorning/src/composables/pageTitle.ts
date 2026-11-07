import { ref } from 'vue'

/**
 * 頁面標題覆寫：作品頁要顯示「某某 的作品」。
 * 頁面上的 h1、document.title（台北通 AppBar 顯示的就是它）一起換，兩邊文字才會一致（台北通 ST）。
 * 換頁時由 router.afterEach 清掉。
 */
export const titleOverride = ref<string | null>(null)

export function setPageTitle(title: string) {
  titleOverride.value = title
  document.title = title
}
