/**
 * 編輯中的草稿：切換分頁、網路失敗、App 被系統回收後都不遺失（localStorage，失敗則只存記憶體）。
 */
import { reactive, watch } from 'vue'
import type { Policy } from '../api/types'
import type { TextLayer } from './layout'
import { SLOGAN, defaultLayers } from './scene'

export interface Draft {
  backgroundId: number | null
  policy: Policy | null
  layers: TextLayer[]
  selected: number
}

const KEY = 'gm.draft.v1'

function fresh(): Draft {
  return { backgroundId: null, policy: null, layers: defaultLayers(), selected: SLOGAN }
}

function restore(): Draft {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fresh()
    const d = JSON.parse(raw) as Draft
    if (!Array.isArray(d.layers) || d.layers.length !== 2) return fresh()
    return { ...fresh(), ...d }
  } catch {
    return fresh()
  }
}

export const draft = reactive<Draft>(restore())

watch(
  draft,
  (d) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(d))
    } catch {
      /* storage 不可用時只保留在記憶體 */
    }
  },
  { deep: true },
)

export function resetDraft(keepBackground = true) {
  const f = fresh()
  if (keepBackground) f.backgroundId = draft.backgroundId
  Object.assign(draft, f)
}
