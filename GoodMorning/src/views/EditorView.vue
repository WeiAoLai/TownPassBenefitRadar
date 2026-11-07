<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { friendlyMessage } from '../api/errors'
import type { Artwork, Background, CurrentUser, Policy } from '../api/types'
import BottomSheet from '../components/BottomSheet.vue'
import BadgeChip from '../components/BadgeChip.vue'
import Icon from '../components/Icon.vue'
import Segmented from '../components/Segmented.vue'
import { openLink } from '../composables/bridge'
import { toast } from '../composables/toast'
import { draft, resetDraft } from '../editor/draft'
import { SIZE, type Layout } from '../editor/layout'
import { QR_LAYOUT } from '../editor/qr'
import { exportPng, loadImage, renderScene, styleSwatch } from '../editor/render'
import { GREETING, POSITIONS, SLOGAN } from '../editor/scene'
import { FONTS, GREETINGS, TEXT_STYLES, type FontKey } from '../editor/styles'
import { SEASONAL_IDS, SEASONAL_LABEL, loadAttractions, type Attraction, type AttractionCatalog } from '../data/attractions'

type Tool = 'bg' | 'policy' | 'text' | 'style'
const router = useRouter()

const tool = ref<Tool>(draft.policy ? 'text' : 'bg')
const tools = [
  { value: 'bg' as const, label: '背景', icon: 'image' },
  { value: 'policy' as const, label: '政策', icon: 'flag' },
  { value: 'text' as const, label: '文字', icon: 'text' },
  { value: 'style' as const, label: '樣式', icon: 'palette' },
]
const layerOptions = [
  { value: GREETING, label: '問候語' },
  { value: SLOGAN, label: '政策標語' },
]
const orientOptions = [
  { value: true, label: '直書', icon: 'vertical' },
  { value: false, label: '橫書', icon: 'horizontal' },
]

const me = ref<CurrentUser | null>(null)
const backgrounds = ref<Background[]>([])
/** 臺北旅遊網景點資料（分類、行政區、介紹頁網址），與 /backgrounds 以 id 對應 */
const catalog = ref<AttractionCatalog | null>(null)
const attractionById = computed(() => new Map<number, Attraction>((catalog.value?.attractions ?? []).map((a) => [a.id, a])))
const ALL = '全部'
const bgFilter = ref<string>(ALL)
const bgQuery = ref('')
const PAGE = 18
const bgLimit = ref(PAGE)
const bgFilters = computed(() => [ALL, SEASONAL_LABEL, ...(catalog.value?.categories ?? []).filter((c) => c !== '其他' && c !== '借問站')])
const filteredBackgrounds = computed(() => {
  const q = bgQuery.value.trim()
  return backgrounds.value.filter((b) => {
    const a = attractionById.value.get(b.id)
    if (bgFilter.value === SEASONAL_LABEL && !SEASONAL_IDS.has(b.id)) return false
    if (bgFilter.value !== ALL && bgFilter.value !== SEASONAL_LABEL && !a?.categories.includes(bgFilter.value)) return false
    if (q && !b.name.includes(q) && !a?.district.includes(q)) return false
    return true
  })
})
const visibleBackgrounds = computed(() => filteredBackgrounds.value.slice(0, bgLimit.value))
watch([bgFilter, bgQuery], () => (bgLimit.value = PAGE))
const currentBg = computed(() => backgrounds.value.find((b) => b.id === draft.backgroundId) ?? null)
const currentAttraction = computed(() => (draft.backgroundId ? attractionById.value.get(draft.backgroundId) : undefined))
const categories = ref<string[]>([])
const category = ref<string>(draft.policy?.category ?? '')
const policies = ref<Policy[]>([])
const loading = ref({ bg: true, cat: true, pol: false })
const loadError = ref<string | null>(null)
const saving = ref(false)
const randomizing = ref(false)
const showQrZone = ref(true)
const saved = ref<{ artwork: Artwork; before: CurrentUser | null; after: CurrentUser | null; unlocked: Background[] } | null>(null)

const layer = computed(() => draft.layers[draft.selected])
const swatches = TEXT_STYLES.map((s) => ({ ...s, img: '' }))

/* ---------------- 畫布 ---------------- */
const canvas = ref<HTMLCanvasElement | null>(null)
const stage = ref<HTMLElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let layouts: Layout[] = []
let bgImage: HTMLImageElement | null = null
let raf = 0
let ro: ResizeObserver | null = null
const imgCache = new Map<number, Promise<HTMLImageElement>>()

/** 預覽解析度跟著實際顯示大小（× 螢幕倍率），舊手機不用每次重畫 1080 圖 */
function sizeCanvas() {
  const c = canvas.value
  if (!c) return
  const css = c.getBoundingClientRect().width || 320
  const px = Math.min(SIZE, Math.round(css * Math.min(window.devicePixelRatio || 1, 2)))
  if (c.width !== px) {
    c.width = px
    c.height = px
  }
  ctx = c.getContext('2d')
  draw()
}

function draw() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    if (!ctx || !canvas.value) return
    const k = canvas.value.width / SIZE
    ctx.setTransform(k, 0, 0, k, 0, 0)
    const { margin, cardW, cardH } = QR_LAYOUT
    layouts = renderScene(
      ctx,
      { background: bgImage, layers: draft.layers },
      {
        selected: draft.selected,
        qrZone: showQrZone.value ? { x: SIZE - margin - cardW, y: SIZE - margin - cardH, w: cardW, h: cardH } : null,
      },
    )
  })
}

function getImage(bg: Background) {
  let p = imgCache.get(bg.id)
  if (!p) {
    p = loadImage(bg.imageUrl)
    p.catch(() => imgCache.delete(bg.id))
    imgCache.set(bg.id, p)
  }
  return p
}

watch(
  () => [draft.backgroundId, backgrounds.value] as const,
  async ([id]) => {
    const bg = backgrounds.value.find((b) => b.id === id)
    if (!bg) {
      bgImage = null
      draw()
      return
    }
    try {
      const img = await getImage(bg)
      if (draft.backgroundId === bg.id) {
        bgImage = img
        draw()
      }
    } catch {
      toast('背景圖載入失敗，請換一張或稍後再試', 'error')
    }
  },
)
watch(() => [draft.layers, draft.selected, showQrZone.value], draw, { deep: true })

/* ---------------- 拖曳文字 ---------------- */
let drag: { idx: number; dx: number; dy: number; id: number } | null = null

function toScene(e: PointerEvent) {
  const r = canvas.value!.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE }
}

function hit(x: number, y: number): number {
  for (let i = layouts.length - 1; i >= 0; i--) {
    const b = layouts[i].box
    if (layouts[i].glyphs.length && x >= b.x - 30 && x <= b.x + b.w + 30 && y >= b.y - 30 && y <= b.y + b.h + 30) return i
  }
  return -1
}

function onDown(e: PointerEvent) {
  const p = toScene(e)
  const i = hit(p.x, p.y)
  if (i < 0) return
  draft.selected = i
  const l = draft.layers[i]
  const b = layouts[i].box
  // 以目前實際顯示位置（可能被夾在畫布內）為拖曳起點
  l.x = (b.x + b.w / 2) / SIZE
  l.y = (b.y + b.h / 2) / SIZE
  drag = { idx: i, dx: p.x - l.x * SIZE, dy: p.y - l.y * SIZE, id: e.pointerId }
  canvas.value?.setPointerCapture(e.pointerId)
}
function onMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const p = toScene(e)
  const l = draft.layers[drag.idx]
  l.x = Math.min(1, Math.max(0, (p.x - drag.dx) / SIZE))
  l.y = Math.min(1, Math.max(0, (p.y - drag.dy) / SIZE))
}
function onUp(e: PointerEvent) {
  if (drag && e.pointerId === drag.id) drag = null
}

/* ---------------- 資料 ---------------- */
async function loadAll() {
  loadError.value = null
  loading.value = { bg: true, cat: true, pol: false }
  try {
    loadAttractions()
      .then((c) => (catalog.value = c))
      .catch(() => {
        /* 分類篩選是輔助功能，載入失敗時仍可從完整清單挑背景 */
      })
    const [u, bgs, cats] = await Promise.all([api.getCurrentUser(), api.listBackgrounds(), api.listPolicyCategories()])
    me.value = u
    backgrounds.value = bgs
    categories.value = cats
    if (draft.backgroundId == null || !bgs.some((b) => b.id === draft.backgroundId && b.unlocked)) {
      draft.backgroundId = bgs.find((b) => b.unlocked)?.id ?? null
    }
    if (!category.value || !cats.includes(category.value)) category.value = cats[0] ?? ''
  } catch (e) {
    loadError.value = friendlyMessage(e)
  } finally {
    loading.value.bg = false
    loading.value.cat = false
  }
}

watch(category, async (c) => {
  if (!c) return
  loading.value.pol = true
  try {
    policies.value = await api.listPolicies(c)
  } catch (e) {
    toast(friendlyMessage(e), 'error')
  } finally {
    loading.value.pol = false
  }
})

/* ---------------- 操作 ---------------- */
function pickBackground(b: Background) {
  if (!b.unlocked) {
    const need = b.unlockThreshold - (me.value?.artworkCount ?? 0)
    toast(`再儲存 ${Math.max(1, need)} 張作品就能解鎖「${b.name}」`, 'info')
    return
  }
  draft.backgroundId = b.id
}

function pickPolicy(p: Policy) {
  draft.policy = p
  draft.layers[SLOGAN].text = p.slogan
  draft.selected = SLOGAN
  toast(`已套用「${p.title}」標語`, 'success', 2500)
}

function restoreSlogan() {
  if (draft.policy) draft.layers[SLOGAN].text = draft.policy.slogan
}

function nudge(dx: number, dy: number) {
  const b = layouts[draft.selected]?.box
  const l = layer.value
  if (b && b.w) {
    l.x = (b.x + b.w / 2) / SIZE
    l.y = (b.y + b.h / 2) / SIZE
  }
  l.x = Math.min(1, Math.max(0, l.x + dx))
  l.y = Math.min(1, Math.max(0, l.y + dy))
}

function setSize(v: number) {
  layer.value.size = Math.min(320, Math.max(40, Math.round(v)))
}

const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)]

async function randomize() {
  randomizing.value = true
  try {
    const p = await api.getRandomPolicy()
    draft.policy = p
    category.value = p.category
    const unlocked = backgrounds.value.filter((b) => b.unlocked)
    if (unlocked.length) draft.backgroundId = pick(unlocked).id
    const [g, s] = draft.layers
    g.text = pick(GREETINGS)
    g.vertical = Math.random() < 0.6
    g.styleId = pick(TEXT_STYLES).id
    s.text = p.slogan
    s.styleId = pick(TEXT_STYLES.filter((t) => t.id !== g.styleId)).id
    draft.selected = SLOGAN
    toast('換好了！可以再調整文字和樣式', 'success', 2500)
  } catch (e) {
    toast(friendlyMessage(e), 'error')
  } finally {
    randomizing.value = false
  }
}

const missing = computed(() => {
  if (!draft.backgroundId) return '請先選一張背景'
  if (!draft.policy) return '請先選一個要宣傳的政策'
  if (!draft.layers[SLOGAN].text.trim()) return '政策標語不能空白'
  if (draft.layers[SLOGAN].text.length > 500) return '標語最多 500 字'
  return null
})

async function save() {
  if (missing.value) {
    toast(missing.value, 'info')
    if (!draft.backgroundId) tool.value = 'bg'
    else if (!draft.policy) tool.value = 'policy'
    else tool.value = 'text'
    return
  }
  saving.value = true
  try {
    if (!bgImage) throw new Error('背景尚未載入')
    let blob: Blob
    try {
      blob = await exportPng({ background: bgImage, layers: draft.layers })
    } catch {
      toast('這張背景無法輸出圖片，請換一張背景再試', 'error')
      return
    }
    if (blob.size > 10 * 1024 * 1024) {
      toast('圖片超過 10 MB，請換一張背景再試', 'error')
      return
    }
    const before = me.value
    const artwork = await api.createArtwork({
      image: blob,
      backgroundId: draft.backgroundId!,
      policyId: draft.policy!.id,
      sloganText: draft.layers[SLOGAN].text,
    })
    const [after, bgs] = await Promise.all([api.getCurrentUser(), api.listBackgrounds()]).catch(
      () => [null, backgrounds.value] as const,
    )
    const unlocked = bgs.filter((b) => b.unlocked && backgrounds.value.some((o) => o.id === b.id && !o.unlocked))
    me.value = after ?? me.value
    backgrounds.value = bgs
    saved.value = { artwork, before, after, unlocked }
  } catch (e) {
    // 草稿保留，使用者可以直接再按一次儲存
    toast(friendlyMessage(e), 'error')
  } finally {
    saving.value = false
  }
}

function makeAnother() {
  saved.value = null
  resetDraft(true)
  tool.value = 'policy'
}

function useUnlocked(b: Background) {
  saved.value = null
  draft.backgroundId = b.id
  tool.value = 'bg'
}

onMounted(() => {
  swatches.forEach((s) => (s.img = styleSwatch(s.id)))
  sizeCanvas()
  if (typeof ResizeObserver !== 'undefined' && stage.value) {
    ro = new ResizeObserver(() => sizeCanvas())
    ro.observe(stage.value)
  } else {
    window.addEventListener('resize', sizeCanvas)
  }
  loadAll()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  window.removeEventListener('resize', sizeCanvas)
})

const canvasLabel = computed(() => {
  const g = draft.layers[GREETING].text.replace(/\n/g, ' ')
  const s = draft.layers[SLOGAN].text.replace(/\n/g, ' ')
  const bg = backgrounds.value.find((b) => b.id === draft.backgroundId)?.name ?? '預設天空'
  return `長輩圖預覽：背景「${bg}」，問候語「${g || '無'}」，標語「${s || '尚未選擇'}」`
})
</script>

<template>
  <div class="editor">
    <div ref="stage" class="stage">
      <canvas
        ref="canvas"
        class="canvas"
        role="img"
        :aria-label="canvasLabel"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
      />
      <div class="stage-row">
        <button type="button" class="btn dark" :disabled="randomizing || !!loadError" @click="randomize">
          <Icon name="dice" /> {{ randomizing ? '挑選中…' : '隨機' }}
        </button>
        <p class="stage-hint small" aria-hidden="true"><Icon name="move" :size="16" /> 按住文字拖曳</p>
        <button
          type="button"
          class="btn primary"
          :disabled="saving || !!loadError"
          :aria-describedby="missing ? 'save-hint' : undefined"
          @click="save"
        >
          <Icon name="check" /> {{ saving ? '儲存中…' : '儲存' }}
        </button>
        <span v-if="missing" id="save-hint" class="visually-hidden">{{ missing }}</span>
      </div>
    </div>

    <div class="tools">
      <Segmented v-model="tool" :options="tools" label="編輯工具" mode="tabs" id-prefix="tool" />
    </div>

    <div v-if="loadError" class="panel" role="alert">
      <p>{{ loadError }}</p>
      <button class="btn primary block" type="button" @click="loadAll"><Icon name="refresh" /> 重新載入</button>
    </div>

    <!-- 背景 -->
    <section
      v-else-if="tool === 'bg'"
      id="tool-panel-bg"
      class="panel"
      role="tabpanel"
      aria-labelledby="tool-tab-bg"
    >
      <div v-if="currentBg" class="bg-current">
        <span class="grow cur-name">
          <span class="small muted">目前</span>
          <strong>{{ currentBg.name }}</strong>
          <span v-if="currentAttraction" class="small muted">{{ currentAttraction.district }}</span>
        </span>
        <button v-if="currentAttraction" type="button" class="btn text" @click="openLink(currentAttraction.url)">
          <Icon name="link" :size="20" /> 景點介紹
        </button>
      </div>
      <label class="search">
        <span class="visually-hidden">搜尋景點或行政區</span>
        <input v-model="bgQuery" type="search" inputmode="search" placeholder="搜尋景點或行政區，例如：北投" enterkeyhint="search" />
      </label>
      <div class="chips" role="radiogroup" aria-label="背景分類">
        <button
          v-for="f in bgFilters"
          :key="f"
          type="button"
          class="chip"
          role="radio"
          :aria-checked="bgFilter === f"
          @click="bgFilter = f"
        >
          <Icon v-if="f === SEASONAL_LABEL" name="lock" :size="16" />
          {{ f }}
        </button>
      </div>
      <p v-if="bgFilter === SEASONAL_LABEL" class="notice small">累積儲存 3 張作品，就能解鎖季節限定的美景</p>
      <div v-if="loading.bg" class="bg-grid">
        <div v-for="i in 6" :key="i" class="bg-item skeleton" />
      </div>
      <p v-else-if="!filteredBackgrounds.length" class="empty">找不到符合的景點，換個關鍵字試試</p>
      <div v-else class="bg-grid" role="radiogroup" :aria-label="`選擇背景，共 ${filteredBackgrounds.length} 個景點`">
        <button
          v-for="b in visibleBackgrounds"
          :key="b.id"
          type="button"
          role="radio"
          class="bg-item"
          :class="{ on: draft.backgroundId === b.id, locked: !b.unlocked }"
          :aria-checked="draft.backgroundId === b.id"
          :aria-disabled="!b.unlocked"
          :aria-label="b.unlocked ? b.name : `${b.name}（儲存 ${b.unlockThreshold} 張作品後解鎖）`"
          @click="pickBackground(b)"
        >
          <img :src="b.imageUrl" alt="" loading="lazy" decoding="async" @error="($event.target as HTMLImageElement).classList.add('broken')" />
          <span class="bg-name">{{ b.name }}</span>
          <span v-if="!b.unlocked" class="lock">
            <Icon name="lock" :size="22" />
            <span>存 {{ b.unlockThreshold }} 張解鎖</span>
          </span>
          <span v-if="draft.backgroundId === b.id" class="tick"><Icon name="check" :size="18" /></span>
        </button>
      </div>
      <button
        v-if="visibleBackgrounds.length < filteredBackgrounds.length"
        type="button"
        class="btn block"
        @click="bgLimit += PAGE"
      >
        看更多景點（還有 {{ filteredBackgrounds.length - visibleBackgrounds.length }} 個）
      </button>
      <p class="credit small muted">
        景點照片：<a href="https://www.travel.taipei/" target="_blank" rel="noopener" @click.prevent="openLink('https://www.travel.taipei/')">臺北旅遊網</a>
      </p>
    </section>

    <!-- 政策 -->
    <section
      v-else-if="tool === 'policy'"
      id="tool-panel-policy"
      class="panel"
      role="tabpanel"
      aria-labelledby="tool-tab-policy"
    >
      <h2 class="panel-title">1. 選政策類別</h2>
      <div class="chips" role="radiogroup" aria-label="政策類別">
        <button
          v-for="c in categories"
          :key="c"
          type="button"
          class="chip"
          role="radio"
          :aria-checked="category === c"
          @click="category = c"
        >
          {{ c }}
        </button>
      </div>
      <h2 class="panel-title">2. 選要宣傳的政策</h2>
      <div v-if="loading.pol" class="list">
        <div v-for="i in 2" :key="i" class="list-row"><span class="grow skeleton" style="height: 40px" /></div>
      </div>
      <p v-else-if="!policies.length" class="empty">這個類別目前沒有可宣傳的政策</p>
      <div v-else class="list" role="radiogroup" aria-label="政策">
        <button
          v-for="p in policies"
          :key="p.id"
          type="button"
          role="radio"
          class="list-row"
          :aria-checked="draft.policy?.id === p.id"
          @click="pickPolicy(p)"
        >
          <span class="grow">
            <span class="row-title">{{ p.title }}</span>
            <span class="row-sub small muted">{{ p.slogan.replace(/\n/g, ' ') }}</span>
          </span>
          <span class="radio" :class="{ on: draft.policy?.id === p.id }" aria-hidden="true">
            <Icon v-if="draft.policy?.id === p.id" name="check" :size="18" />
          </span>
        </button>
      </div>
      <button
        v-if="draft.policy"
        type="button"
        class="btn text block source"
        @click="openLink(draft.policy.sourceUrl)"
      >
        <Icon name="link" :size="20" /> 看「{{ draft.policy.title }}」政策說明
      </button>
    </section>

    <!-- 文字 -->
    <section
      v-else-if="tool === 'text'"
      id="tool-panel-text"
      class="panel"
      role="tabpanel"
      aria-labelledby="tool-tab-text"
    >
      <Segmented v-model="draft.selected" :options="layerOptions" label="要編輯的文字" />
      <template v-if="draft.selected === GREETING">
        <div class="chips greet" role="group" aria-label="常用問候語">
          <button
            v-for="g in GREETINGS"
            :key="g"
            type="button"
            class="chip"
            :aria-pressed="layer.text === g"
            @click="layer.text = g"
          >
            {{ g.replace('\n', ' ') }}
          </button>
        </div>
        <label class="field">
          <span class="field-label">問候語（可換行，留空就不顯示）</span>
          <textarea v-model="layer.text" rows="2" maxlength="40" />
        </label>
      </template>
      <template v-else>
        <p v-if="!draft.policy" class="notice small">
          先到「政策」選一個政策，標語會自動帶進來
          <button type="button" class="btn text" @click="tool = 'policy'">去選政策</button>
        </p>
        <label class="field">
          <span class="field-label">
            政策標語
            <span class="counter small muted">{{ layer.text.length }}/500</span>
          </span>
          <textarea v-model="layer.text" rows="4" maxlength="500" aria-describedby="slogan-help" />
          <span id="slogan-help" class="small muted">可以照自己的話修改；按 Enter 換行，字太多會自動縮小</span>
        </label>
        <button
          v-if="draft.policy && layer.text !== draft.policy.slogan"
          type="button"
          class="btn block"
          @click="restoreSlogan"
        >
          <Icon name="refresh" :size="20" /> 還原成原本的政策標語
        </button>
      </template>
    </section>

    <!-- 樣式 -->
    <section
      v-else
      id="tool-panel-style"
      class="panel"
      role="tabpanel"
      aria-labelledby="tool-tab-style"
    >
      <Segmented v-model="draft.selected" :options="layerOptions" label="要調整的文字" />

      <h2 class="panel-title">字的顏色</h2>
      <div class="swatches" role="radiogroup" aria-label="文字樣式">
        <button
          v-for="s in swatches"
          :key="s.id"
          type="button"
          role="radio"
          class="swatch"
          :aria-checked="layer.styleId === s.id"
          @click="layer.styleId = s.id"
        >
          <img :src="s.img" alt="" width="60" height="60" />
          <span class="small">{{ s.name }}</span>
        </button>
      </div>

      <h2 class="panel-title">排列</h2>
      <Segmented v-model="layer.vertical" :options="orientOptions" label="文字排列方向" />

      <h2 class="panel-title">字體</h2>
      <div class="chips" role="radiogroup" aria-label="字體">
        <button
          v-for="f in FONTS"
          :key="f.key"
          type="button"
          class="chip"
          role="radio"
          :aria-checked="layer.font === f.key"
          :style="{ fontFamily: f.family }"
          @click="layer.font = f.key as FontKey"
        >
          {{ f.name }}
        </button>
      </div>

      <h2 class="panel-title" id="size-label">字的大小</h2>
      <div class="stepper">
        <button type="button" class="round" aria-label="字變小" @click="setSize(layer.size - 12)">
          <Icon name="minus" />
        </button>
        <input
          type="range"
          min="40"
          max="320"
          step="4"
          :value="layer.size"
          aria-labelledby="size-label"
          :aria-valuetext="`${layer.size} 像素`"
          @input="setSize(Number(($event.target as HTMLInputElement).value))"
        />
        <button type="button" class="round" aria-label="字變大" @click="setSize(layer.size + 12)">
          <Icon name="plus" />
        </button>
      </div>

      <h2 class="panel-title">位置</h2>
      <div class="pos-wrap">
        <div class="pos-grid" role="group" aria-label="快速放到九宮格位置">
          <button
            v-for="p in POSITIONS"
            :key="p.label"
            type="button"
            class="pos"
            :aria-label="`放到${p.label}`"
            @click="Object.assign(layer, { x: p.x, y: p.y })"
          >
            <span aria-hidden="true" class="dot" />
          </button>
        </div>
        <div class="nudge" role="group" aria-label="微調位置">
          <span />
          <button type="button" class="round" aria-label="往上移" @click="nudge(0, -0.03)"><Icon name="chevron-left" style="transform: rotate(90deg)" /></button>
          <span />
          <button type="button" class="round" aria-label="往左移" @click="nudge(-0.03, 0)"><Icon name="chevron-left" /></button>
          <span />
          <button type="button" class="round" aria-label="往右移" @click="nudge(0.03, 0)"><Icon name="chevron-right" /></button>
          <span />
          <button type="button" class="round" aria-label="往下移" @click="nudge(0, 0.03)"><Icon name="chevron-right" style="transform: rotate(90deg)" /></button>
          <span />
        </div>
      </div>

      <label class="switch-row list-row">
        <span class="grow">
          顯示 QR Code 位置
          <span class="small muted block">下載時右下角會加上政策 QR Code</span>
        </span>
        <input v-model="showQrZone" type="checkbox" role="switch" class="switch" />
      </label>

      <button type="button" class="btn text block" @click="resetDraft(true)">
        <Icon name="refresh" :size="20" /> 文字全部重來
      </button>
    </section>


    <BottomSheet :open="!!saved" title="儲存成功" @close="saved = null">
      <div v-if="saved" class="saved">
        <img class="saved-img" :src="saved.artwork.imageUrl" alt="剛儲存的長輩圖" />
        <p class="saved-count">
          這是你的第 <strong>{{ saved.after?.artworkCount ?? '—' }}</strong> 張作品
        </p>
        <div
          v-if="saved.after?.badge && saved.after.badge.level !== saved.before?.badge?.level"
          class="reward"
        >
          <span class="reward-title">獲得新徽章</span>
          <BadgeChip :badge="saved.after.badge" />
        </div>
        <div v-for="b in saved.unlocked" :key="b.id" class="reward">
          <span class="reward-title">解鎖新背景「{{ b.name }}」</span>
          <button type="button" class="btn" @click="useUnlocked(b)">馬上用</button>
        </div>
        <div class="saved-actions">
          <button type="button" class="btn primary block large" @click="makeAnother">再做一張</button>
          <button type="button" class="btn block large" @click="router.push('/me')">看我的作品</button>
        </div>
      </div>
    </BottomSheet>
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  /* 極小螢幕或字級放大時，整頁可捲動，不會切掉工具 */
  overflow-y: auto;
  max-width: 600px;
  margin: 0 auto;
}
.stage {
  flex: none;
  padding: 10px 16px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--tp-grey-900);
}
.canvas {
  display: block;
  width: min(100%, 37vh);
  aspect-ratio: 1;
  height: auto;
  border-radius: 6px;
  touch-action: pinch-zoom;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
@supports (height: 1dvh) {
  .canvas {
    width: min(100%, 37dvh);
  }
}
.stage-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 0 4px;
}
.stage-row .btn {
  flex: none;
  white-space: nowrap;
  padding: 10px 16px;
}
.stage-hint {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--tp-grey-200);
  text-align: center;
}
@media (max-width: 380px) {
  .stage-hint {
    display: none;
  }
}
.btn.dark {
  background: transparent;
  color: #fff;
  border-color: rgba(255, 255, 255, 0.6);
}
.tools {
  flex: none;
  padding: 10px 12px 6px;
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-line);
}
.panel {
  flex: 1 1 auto;
  min-height: 150px;
  overflow-y: auto;
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.panel-title {
  font-size: var(--tp-font-h3);
  font-weight: 600;
  margin-top: 6px;
}
/* 背景 */
.bg-current {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px 0 14px;
  border-radius: var(--radius-m);
  background: var(--c-surface);
  box-shadow: var(--shadow-1);
}
.cur-name {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.search input {
  width: 100%;
  min-height: 48px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1.5px solid var(--tp-grey-200);
  background: var(--c-surface);
}
.search input:focus {
  outline: none;
  border-color: var(--c-brand);
  box-shadow: 0 0 0 3px var(--tp-primary-100);
}
.chip .icon {
  display: inline-block;
  vertical-align: -2px;
}
.bg-item img.broken {
  visibility: hidden;
}
.credit {
  text-align: center;
}
.bg-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.bg-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-m);
  overflow: hidden;
  border: 3px solid transparent;
  background: var(--tp-grey-100);
  min-height: 48px;
}
.bg-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.bg-item.on {
  border-color: var(--c-brand);
}
.bg-name {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 14px 6px 4px;
  font-size: var(--tp-font-body);
  line-height: 1.2;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.65));
}
.lock {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: rgba(23, 27, 29, 0.6);
  color: #fff;
  font-size: var(--tp-font-body);
  font-weight: 600;
}
.tick {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--c-brand);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 政策 */
.row-title {
  display: block;
  font-weight: 600;
}
.row-sub {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.radio {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--tp-grey-300);
  display: flex;
  align-items: center;
  justify-content: center;
}
.radio.on {
  background: var(--c-brand);
  border-color: var(--c-brand);
  color: #fff;
}
.source {
  margin-top: 4px;
}

/* 文字 */
.greet {
  flex-wrap: wrap;
  overflow: visible;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
}
.field textarea {
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--radius-m);
  border: 1.5px solid var(--tp-grey-200);
  background: var(--c-surface);
  font-size: 1.1rem;
  line-height: 1.5;
  resize: vertical;
}
.field textarea:focus {
  border-color: var(--c-brand);
  outline: none;
  box-shadow: 0 0 0 3px var(--tp-primary-100);
}
.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 6px 6px 14px;
  border-radius: var(--radius-m);
  background: var(--c-accent-soft);
  color: var(--tp-secondary-800);
}

/* 樣式 */
.swatches {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.swatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 2px;
  border-radius: var(--radius-m);
  border: 2px solid transparent;
  background: var(--c-surface);
}
.swatch img {
  width: 60px;
  height: 60px;
  border-radius: 10px;
}
.swatch[aria-checked='true'] {
  border-color: var(--c-brand);
  background: var(--c-brand-soft);
}
.stepper {
  display: flex;
  align-items: center;
  gap: 10px;
}
.stepper input {
  flex: 1;
  min-height: 48px;
  accent-color: var(--c-brand);
}
.round {
  flex: none;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--c-surface);
  border: 1.5px solid var(--tp-grey-200);
  color: var(--tp-grey-700);
}
.round:active {
  background: var(--tp-grey-50);
}
.pos-wrap {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-around;
  flex-wrap: wrap;
}
.pos-grid,
.nudge {
  display: grid;
  grid-template-columns: repeat(3, 48px);
  gap: 4px;
}
.pos {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: var(--tp-grey-100);
  display: flex;
  align-items: center;
  justify-content: center;
}
.pos .dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--tp-grey-500);
}
.pos:active {
  background: var(--tp-primary-100);
}
.switch-row {
  border-radius: var(--radius-m);
  box-shadow: var(--shadow-1);
  cursor: pointer;
}
span.block {
  display: block;
}
.switch {
  appearance: none;
  -webkit-appearance: none;
  flex: none;
  width: 52px;
  height: 32px;
  border-radius: 16px;
  background: var(--tp-grey-200);
  position: relative;
  transition: background-color 0.2s ease;
  margin: 8px 0;
}
.switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: transform 0.2s ease;
}
.switch:checked {
  background: var(--tp-green-500);
}
.switch:checked::after {
  transform: translateX(20px);
}

/* 儲存成功 */
.saved {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.saved-img {
  width: 70%;
  margin: 0 auto;
  border-radius: var(--radius-m);
  box-shadow: var(--shadow-1);
}
.saved-count {
  text-align: center;
}
.reward {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 14px;
  border-radius: var(--radius-m);
  background: var(--c-accent-soft);
}
.reward-title {
  font-weight: 600;
  color: var(--tp-secondary-800);
}
.saved-actions {
  display: grid;
  gap: 10px;
}

@media (min-width: 900px) and (orientation: landscape) {
  .editor {
    max-width: 1000px;
  }
}
</style>
