import { ref } from 'vue'
import { api } from '../api'
import { friendlyMessage } from '../api/errors'
import type { Artwork } from '../api/types'
import { toast } from './toast'

const pendingLike = new Set<number>()

/** 愛心：樂觀更新，失敗時復原並提示 */
export async function toggleLike(a: Artwork) {
  if (a.ownedByMe) {
    toast('自己的作品不能按愛心喔', 'info')
    return
  }
  if (pendingLike.has(a.id)) return
  pendingLike.add(a.id)
  const before = { liked: a.likedByMe, count: a.likeCount }
  a.likedByMe = !before.liked
  a.likeCount = Math.max(0, before.count + (a.likedByMe ? 1 : -1))
  try {
    const s = before.liked ? await api.unlikeArtwork(a.id) : await api.likeArtwork(a.id)
    a.likedByMe = s.liked
    a.likeCount = s.likeCount
  } catch (e) {
    a.likedByMe = before.liked
    a.likeCount = before.count
    toast(friendlyMessage(e), 'error')
  } finally {
    pendingLike.delete(a.id)
  }
}

/** 下載面板（全域單一實例，掛在 App.vue） */
export const downloadState = ref<{
  artwork: Artwork | null
  loading: boolean
  url: string | null
  blob: Blob | null
  filename: string
  error: string | null
}>({ artwork: null, loading: false, url: null, blob: null, filename: '', error: null })

export async function startDownload(a: Artwork) {
  const s = downloadState.value
  if (s.url) URL.revokeObjectURL(s.url)
  downloadState.value = { artwork: a, loading: true, url: null, blob: null, filename: '', error: null }
  try {
    const { blob, filename } = await api.downloadArtwork(a.id)
    // 下載數由後端計算；非作者每次成功取得檔案 +1
    if (!a.ownedByMe) a.downloadCount += 1
    downloadState.value = { artwork: a, loading: false, url: URL.createObjectURL(blob), blob, filename, error: null }
  } catch (e) {
    downloadState.value = { ...downloadState.value, loading: false, error: friendlyMessage(e) }
  }
}

export function closeDownload() {
  const s = downloadState.value
  if (s.url) URL.revokeObjectURL(s.url)
  downloadState.value = { artwork: null, loading: false, url: null, blob: null, filename: '', error: null }
}
