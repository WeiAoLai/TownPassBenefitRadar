<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { friendlyMessage } from '../api/errors'
import type { Artwork, Background, CurrentUser, Policy } from '../api/types'
import BottomSheet from '../components/BottomSheet.vue'
import BadgeCelebration from '../components/BadgeCelebration.vue'
import Icon from '../components/Icon.vue'
import Segmented from '../components/Segmented.vue'
import { distanceKm, getLocation, openLink, type LatLng } from '../composables/bridge'
import { toast } from '../composables/toast'
import { startDownload } from '../composables/artworkActions'
import { unlockAudio } from '../composables/sound'
import { draft, resetDraft } from '../editor/draft'
import { SIZE, type Layout } from '../editor/layout'
import { QR_LAYOUT } from '../editor/qr'
import { HANDLE_R, exportPng, handlePoint, isTainted, loadImage, renderScene, styleSwatch } from '../editor/render'
import { GREETING, POSITIONS, SLOGAN } from '../editor/scene'
import { FONTS, GREETINGS, TEXT_STYLES, type FontKey } from '../editor/styles'
import { loadBackgroundCatalog, type BackgroundItem } from '../data/backgrounds'
import { customPhoto, loadCustomPhoto, photoErrorMessage } from '../editor/customPhoto'

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
/** 背景圖庫（名稱、行政區、攝影師、出處），與 /backgrounds 以 id 對應 */
const catalog = ref<BackgroundItem[]>([])
const infoById = computed(() => new Map<number, BackgroundItem>(catalog.value.map((b) => [b.id, b])))
const currentBg = computed(() => backgrounds.value.find((b) => b.id === draft.backgroundId) ?? null)
/* 離我最近：使用者按下按鈕才定位，位置只留在這個頁面的記憶體裡，不送出、不儲存 */
const myPos = ref<LatLng | null>(null)
const locating = ref(false)
const sortedBackgrounds = computed(() => {
  const pos = myPos.value
  const list = backgrounds.value.map((b) => {
    const info = infoById.value.get(b.id)
    const km = pos && info ? distanceKm(pos, { lat: info.lat, lng: info.lng }) : null
    return { ...b, km }
  })
  return pos ? [...list].sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9)) : list
})
const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} 公尺` : `${km.toFixed(km < 10 ? 1 : 0)} 公里`)

async function sortByNearby() {
  if (myPos.value) {
    myPos.value = null
    return
  }
  locating.value = true
  try {
    const pos = await getLocation()
    if (!pos) {
      toast('沒有取得位置，可以直接從下面挑背景', 'info')
      return
    }
    myPos.value = pos
    toast('已依距離排序，最近的地標在最前面', 'success', 2500)
  } finally {
    locating.value = false
  }
}

const currentInfo = computed(() => (draft.backgroundId ? infoById.value.get(draft.backgroundId) : undefined))
const categories = ref<string[]>([])
const category = ref<string>(draft.policy?.category ?? '')
const policies = ref<Policy[]>([])
const loading = ref({ bg: true, cat: true, pol: false })
const loadError = ref<string | null>(null)
const saving = ref(false)
const randomizing = ref(false)
const showQrZone = ref(true)
const bgTainted = ref(false)
const saved = ref<{ artwork: Artwork; before: CurrentUser | null; after: CurrentUser | null; unlocked: Background[] } | null>(null)
/** 剛拿到的新徽章：有值時先顯示全螢幕慶祝畫面，關閉後才出現「儲存成功」視窗 */
const celebrate = ref<{ level: number; name: string } | null>(null)

const layer = computed(() => draft.layers[draft.selected])
const swatches = TEXT_STYLES.map((s) => ({ ...s, img: '' }))

/* ---------------- 畫布 ---------------- */
const canvas = ref<HTMLCanvasElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const editorEl = ref<HTMLElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let layouts: Layout[] = []
let bgImage: HTMLImageElement | null = null
let raf = 0
let ro: ResizeObserver | null = null
const imgCache = new Map<number, Promise<HTMLImageElement>>()
/** 正在畫的背景：自己的照片優先，否則用圖庫背景 */
const activeBg = () => customPhoto.value?.canvas ?? bgImage

/** 預覽解析度跟著實際顯示大小（× 螢幕倍率），舊手機不用每次重畫 1080 圖 */
function sizeCanvas() {
  const c = canvas.value
  if (!c) return
  // 直式手機：工具分頁黏在預覽下方，需要知道預覽區實際高度
  if (stage.value && editorEl.value) editorEl.value.style.setProperty('--stage-h', `${stage.value.offsetHeight}px`)
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
      { background: activeBg(), layers: draft.layers },
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
        bgTainted.value = isTainted(img)
        draw()
      }
    } catch {
      toast('背景圖載入失敗，請換一張或稍後再試', 'error')
    }
  },
)
watch(() => [draft.layers, draft.selected, showQrZone.value, customPhoto.value], draw, { deep: true })

/* ---------------- 拖曳文字：拖框移動、拖右下角把手縮放 ---------------- */
type Drag =
  | { mode: 'move'; idx: number; dx: number; dy: number; id: number }
  | { mode: 'resize'; idx: number; cx: number; cy: number; startDist: number; startSize: number; id: number }
let drag: Drag | null = null

function toScene(e: PointerEvent) {
  const r = canvas.value!.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE }
}

/** 手指的觸控範圍：至少 24 CSS px，換算成 1080 座標 */
function touchSlop() {
  const w = canvas.value?.getBoundingClientRect().width || 320
  return (24 * SIZE) / w
}

function hit(x: number, y: number): number {
  const slop = touchSlop()
  for (let i = layouts.length - 1; i >= 0; i--) {
    const b = layouts[i].box
    if (layouts[i].glyphs.length && x >= b.x - slop && x <= b.x + b.w + slop && y >= b.y - slop && y <= b.y + b.h + slop) return i
  }
  return -1
}

function onDown(e: PointerEvent) {
  const p = toScene(e)
  const sel = layouts[draft.selected]
  // 先看是不是抓到選取中文字的縮放把手
  if (sel?.glyphs.length) {
    const h = handlePoint(sel.box)
    if (Math.hypot(p.x - h.x, p.y - h.y) <= HANDLE_R + touchSlop()) {
      const l = draft.layers[draft.selected]
      const cx = sel.box.x + sel.box.w / 2
      const cy = sel.box.y + sel.box.h / 2
      l.x = cx / SIZE
      l.y = cy / SIZE
      l.size = sel.fontSize
      drag = { mode: 'resize', idx: draft.selected, cx, cy, startDist: Math.max(40, Math.hypot(p.x - cx, p.y - cy)), startSize: sel.fontSize, id: e.pointerId }
      canvas.value?.setPointerCapture(e.pointerId)
      return
    }
  }
  const i = hit(p.x, p.y)
  if (i < 0) return
  draft.selected = i
  const l = draft.layers[i]
  const b = layouts[i].box
  // 以目前實際顯示位置（可能被夾在畫布內）為拖曳起點
  l.x = (b.x + b.w / 2) / SIZE
  l.y = (b.y + b.h / 2) / SIZE
  drag = { mode: 'move', idx: i, dx: p.x - l.x * SIZE, dy: p.y - l.y * SIZE, id: e.pointerId }
  canvas.value?.setPointerCapture(e.pointerId)
}
function onMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const p = toScene(e)
  const l = draft.layers[drag.idx]
  if (drag.mode === 'resize') {
    const d = Math.hypot(p.x - drag.cx, p.y - drag.cy)
    setSize((drag.startSize * d) / drag.startDist)
    return
  }
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
    loadBackgroundCatalog()
      .then((c) => (catalog.value = c.backgrounds))
      .catch(() => {
        /* 攝影師標示是輔助資訊，載入失敗不影響挑背景 */
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
  customPhoto.value = null
  draft.backgroundId = b.id
}

/* ---------------- 自己的照片 ---------------- */
const photoInput = ref<HTMLInputElement | null>(null)
const photoLoading = ref(false)

function choosePhoto() {
  photoInput.value?.click()
}

async function onPhotoPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // 同一張照片可以再選一次
  if (!file) return
  photoLoading.value = true
  try {
    customPhoto.value = await loadCustomPhoto(file)
    bgTainted.value = false
    toast('已換成你的照片', 'success', 2500)
  } catch (err) {
    toast(photoErrorMessage(err), 'error')
  } finally {
    photoLoading.value = false
  }
}

function removePhoto() {
  customPhoto.value = null
}

function pickPolicy(p: Policy) {
  draft.policy = p
  draft.layers[SLOGAN].text = p.slogan
  draft.selected = SLOGAN
  toast(`已套用「${p.title}」標語`, 'success')
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
    if (unlocked.length) {
      customPhoto.value = null
      draft.backgroundId = pick(unlocked).id
    }
    const [g, s] = draft.layers
    g.text = pick(GREETINGS)
    g.vertical = Math.random() < 0.6
    g.styleId = pick(TEXT_STYLES).id
    s.text = p.slogan
    s.styleId = pick(TEXT_STYLES.filter((t) => t.id !== g.styleId)).id
    draft.selected = SLOGAN
    toast('換好了！可以再調整文字和樣式', 'success')
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
  // 儲存後若拿到新徽章會播慶祝音效；瀏覽器要在「點擊當下」才允許解鎖聲音，所以放在最前面
  unlockAudio()
  if (missing.value) {
    toast(missing.value, 'info')
    if (!draft.backgroundId) tool.value = 'bg'
    else if (!draft.policy) tool.value = 'policy'
    else tool.value = 'text'
    return
  }
  saving.value = true
  try {
    const bgDrawable = activeBg()
    if (!bgDrawable) {
      toast('背景照片還沒載入完成，請稍等一下再按儲存', 'info')
      return
    }
    if (isTainted(bgDrawable)) {
      toast('這張背景照片無法輸出，請換一張背景再儲存', 'error')
      return
    }
    let blob: Blob
    try {
      blob = await exportPng({ background: bgDrawable, layers: draft.layers })
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
    const gained = after?.badge
    if (gained && gained.level !== before?.badge?.level) celebrate.value = { level: gained.level, name: gained.name }
  } catch (e) {
    // 草稿保留，使用者可以直接再按一次儲存
    toast(friendlyMessage(e), 'error')
  } finally {
    saving.value = false
  }
}

/** 存到手機：關掉儲存成功視窗，打開附 QR Code 成品圖的下載視窗（作者下載不計入下載數） */
function saveToPhone() {
  const a = saved.value?.artwork
  if (!a) return
  saved.value = null
  startDownload(a)
}

function makeAnother() {
  saved.value = null
  resetDraft(true)
  tool.value = 'policy'
}

function useUnlocked(b: Background) {
  saved.value = null
  customPhoto.value = null
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
  const bg = customPhoto.value ? '我的照片' : (backgrounds.value.find((b) => b.id === draft.backgroundId)?.name ?? '預設天空')
  return `長輩圖預覽：背景「${bg}」，問候語「${g || '無'}」，標語「${s || '尚未選擇'}」`
})
</script>

<template>
  <div ref="editorEl" class="editor">
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
    </div>

    <div class="right">
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
      <div class="my-photo" :class="{ on: !!customPhoto }">
        <img v-if="customPhoto" :src="customPhoto.thumb" alt="" class="my-thumb" />
        <span v-else class="my-thumb empty" aria-hidden="true"><Icon name="camera" :size="28" /></span>
        <span class="grow">
          <strong class="my-title">{{ customPhoto ? '正在用你的照片' : '用自己的照片' }}</strong>
          <span class="small muted block">{{ customPhoto ? '照片會成為作品的一部分，儲存後大家都看得到' : '拍一張或從相簿挑，會裁成正方形' }}</span>
        </span>
        <span class="my-acts">
          <button type="button" class="btn" :class="customPhoto ? '' : 'primary'" :disabled="photoLoading" @click="choosePhoto">
            {{ photoLoading ? '讀取中…' : customPhoto ? '換一張' : '選照片' }}
          </button>
          <button v-if="customPhoto" type="button" class="btn text" @click="removePhoto">不用了</button>
        </span>
        <input ref="photoInput" type="file" accept="image/*" class="visually-hidden" tabindex="-1" aria-hidden="true" @change="onPhotoPicked" />
      </div>
      <p class="panel-title or">{{ customPhoto ? '或換回台北地標' : '或選一張台北地標' }}</p>
      <div v-if="currentBg && !customPhoto" class="bg-current">
        <span class="grow cur-name">
          <span class="small muted">目前</span>
          <strong>{{ currentBg.name }}</strong>
          <span v-if="currentInfo" class="small muted">{{ currentInfo.district }}</span>
        </span>
      </div>
      <p v-if="bgTainted" class="notice small">這張照片無法輸出，請換一張背景</p>
      <button type="button" class="btn block" :aria-pressed="!!myPos" :disabled="locating" @click="sortByNearby">
        <Icon name="flag" :size="20" />
        {{ locating ? '定位中…' : myPos ? '恢復原本順序' : '離我最近的地標排前面' }}
      </button>
      <p v-if="!myPos" class="small muted">按下後會詢問定位權限；位置只用來排序，不會儲存或上傳。</p>
      <div v-if="loading.bg" class="bg-grid">
        <div v-for="i in 6" :key="i" class="bg-item skeleton" />
      </div>
      <div v-else class="bg-grid" role="radiogroup" aria-label="選擇背景">
        <button
          v-for="b in sortedBackgrounds"
          :key="b.id"
          type="button"
          role="radio"
          class="bg-item"
          :class="{ on: !customPhoto && draft.backgroundId === b.id, locked: !b.unlocked }"
          :aria-checked="!customPhoto && draft.backgroundId === b.id"
          :aria-disabled="!b.unlocked"
          :aria-label="b.unlocked ? b.name : `${b.name}（儲存 ${b.unlockThreshold} 張作品後解鎖）`"
          @click="pickBackground(b)"
        >
          <img :src="b.imageUrl" alt="" loading="lazy" decoding="async" />
          <span class="bg-name">{{ b.name }}<span v-if="b.km != null" class="km">{{ fmtKm(b.km) }}</span></span>
          <span v-if="!b.unlocked" class="lock">
            <Icon name="lock" :size="22" />
            <span>存 {{ b.unlockThreshold }} 張解鎖</span>
          </span>
          <span v-if="!customPhoto && draft.backgroundId === b.id" class="tick"><Icon name="check" :size="18" /></span>
        </button>
      </div>
      <p v-if="currentInfo && !customPhoto" class="credit small muted">
        照片：<a :href="currentInfo.photoUrl" target="_blank" rel="noopener" @click.prevent="openLink(currentInfo.photoUrl)">{{ currentInfo.author }}／Unsplash</a>
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

      <h2 class="panel-title">大小與位置</h2>
      <p class="small muted">在圖上按住文字可以移動，拖右下角的圓形把手可以放大縮小</p>
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
        <div class="nudge" role="group" aria-label="微調大小與位置">
          <button type="button" class="round" aria-label="字變小" @click="setSize(layer.size - 16)"><Icon name="minus" /></button>
          <button type="button" class="round" aria-label="往上移" @click="nudge(0, -0.03)"><Icon name="chevron-left" style="transform: rotate(90deg)" /></button>
          <button type="button" class="round" aria-label="字變大" @click="setSize(layer.size + 16)"><Icon name="plus" /></button>
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
        <span class="switch-state" aria-hidden="true">{{ showQrZone ? '開' : '關' }}</span>
        <input v-model="showQrZone" type="checkbox" role="switch" class="switch" />
      </label>

      <button type="button" class="btn text block" @click="resetDraft(true)">
        <Icon name="refresh" :size="20" /> 文字全部重來
      </button>
    </section>


    <!-- Figma Section_one line text_button/m：固定在畫面底部，按鈕不會被捲走 -->
    <div class="section-bar actionbar">
      <p class="one-line" :id="missing ? 'save-hint' : undefined" aria-live="polite">
        {{ missing ?? '按住圖上的文字可以拖曳位置' }}
      </p>
      <div class="btns">
        <button type="button" class="btn" :disabled="randomizing || !!loadError" @click="randomize">
          <Icon name="dice" :size="20" /> {{ randomizing ? '挑選中…' : '隨機一張' }}
        </button>
        <button
          type="button"
          class="btn primary"
          :disabled="saving || !!loadError"
          :aria-describedby="missing ? 'save-hint' : undefined"
          @click="save"
        >
          <Icon name="check" :size="20" /> {{ saving ? '儲存中…' : '儲存作品' }}
        </button>
      </div>
    </div>
    </div>

    <BadgeCelebration :badge="celebrate" @close="celebrate = null" />

    <BottomSheet :open="!!saved && !celebrate" title="儲存成功" @close="saved = null">
      <div v-if="saved" class="saved">
        <img class="saved-img" :src="saved.artwork.imageUrl" alt="剛儲存的長輩圖" />
        <p class="saved-count">
          這是你的第 <strong>{{ saved.after?.artworkCount ?? '—' }}</strong> 張作品
        </p>
        <div v-for="b in saved.unlocked" :key="b.id" class="reward">
          <span class="reward-title">解鎖新背景「{{ b.name }}」</span>
          <button type="button" class="btn" @click="useUnlocked(b)">馬上用</button>
        </div>
        <div class="saved-actions">
          <button type="button" class="btn primary block large" @click="saveToPhone">
            <Icon name="download" :size="20" /> 存到手機相簿
          </button>
          <button type="button" class="btn block large" @click="makeAnother">再做一張</button>
          <button type="button" class="btn text block" @click="router.push('/me')">看我的作品</button>
        </div>
      </div>
    </BottomSheet>
  </div>
</template>

<style scoped>
/*
 * 自適應版面（以 Pixel Pro 412 × ~780 WebView 為基準）：
 * 預覽、工具分頁、工具內容、底部按鈕列依序排成一欄，彼此不重疊；
 * 只有工具內容區會捲動，按鈕列永遠完整顯示在底部。
 * 橫式或寬螢幕：左邊預覽，右邊工具＋按鈕列。
 */
.editor {
  --canvas: min(100%, 34vh);
  height: 100%;
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}
@supports (height: 1svh) {
  .editor {
    --canvas: min(100%, 34svh);
  }
}
.stage {
  flex: none;
  /* 上下留 8px：字級放大後工具區變矮，把預覽周圍的空白讓出來 */
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--c-bg);
}
.right {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.canvas {
  display: block;
  width: var(--canvas);
  max-width: 100%;
  aspect-ratio: 1;
  height: auto;
  border-radius: 8px;
  box-shadow: var(--shadow-1);
  touch-action: pinch-zoom;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.actionbar {
  flex: none;
}
.tools {
  flex: none;
  padding: 0 8px;
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-line);
}
.panel {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 16px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

/* 橫式手機、平板、桌機：兩欄，各自完整顯示 */
@media (orientation: landscape) and (min-width: 640px), (min-width: 900px) {
  .editor {
    max-width: 1120px;
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(320px, 1fr);
    --canvas: min(100%, calc(100vh - 160px));
  }
  @supports (height: 1svh) {
    .editor {
      --canvas: min(100%, calc(100svh - 160px));
    }
  }
  .stage {
    justify-content: center;
    padding: 16px;
    min-height: 0;
  }
  .right {
    height: 100%;
    border-left: 1px solid var(--c-line);
    background: var(--c-bg);
  }
  .canvas {
    min-width: 160px;
  }
}

/* 很矮的畫面（橫式手機、字級放大、鍵盤彈出）：改成整頁捲動，工具區不會被壓扁 */
@media (max-height: 560px) {
  .editor {
    height: auto;
  }
  .right {
    height: auto;
    display: block;
  }
  .panel {
    overflow: visible;
  }
}

/* 工具區的每個區塊維持原本高度，內容多就往下排、由工具區捲動，不會被壓扁截掉 */
.panel > * {
  flex-shrink: 0;
}
.panel-title {
  font-size: 1.25rem;
  line-height: 1.75rem;
  font-weight: 700;
  margin-top: 6px;
}
/* 背景 */
.my-photo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-m);
  background: var(--c-surface);
  box-shadow: var(--shadow-1);
  border: 2px solid transparent;
}
.my-title {
  display: block;
}
.my-photo.on {
  border-color: var(--tp-primary-500);
}
.my-thumb {
  flex: none;
  width: 56px;
  height: 56px;
  border-radius: 8px;
  object-fit: cover;
}
.my-thumb.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tp-primary-50, #edf8fa);
  color: var(--tp-primary-700);
}
.my-acts {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
}
.panel-title.or {
  margin: 4px 0 -4px;
}
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
  border-radius: 8px;
  border: 1.5px solid var(--tp-grey-200);
  background: var(--c-surface);
}
.search input:focus {
  outline: none;
  border-color: var(--c-action);
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
/* 照片出處連結：點擊範圍至少 48px 高（原本只有一行字的高度 23px） */
.credit a {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
}
.km {
  display: block;
  font-weight: 400;
  font-size: 0.75rem;
  opacity: 0.9;
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
  border-color: var(--c-action);
}
.bg-name {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 18px 6px 5px;
  font-size: var(--tp-font-body);
  line-height: 1.25;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.78));
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
  background: var(--c-action);
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
/* 政策標語預覽：最多顯示兩行（原本單行截斷，長輩看不到內容就很難選） */
.row-sub {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  margin-top: 2px;
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
  background: var(--c-action);
  border-color: var(--c-action);
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
  border: 2px solid var(--tp-grey-500);
  background: var(--c-surface);
  font-size: 1.25rem;
  line-height: 1.6;
  resize: vertical;
}
.field textarea:focus {
  border-color: var(--c-action);
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
  border-color: var(--c-action);
  background: var(--c-brand-soft);
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
