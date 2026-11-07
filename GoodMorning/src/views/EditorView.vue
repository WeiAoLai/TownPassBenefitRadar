<script setup lang="ts">
import '@fontsource-variable/noto-sans-tc/wght.css'
import '@fontsource-variable/noto-serif-tc/wght.css'
import '@fontsource/lxgw-wenkai-tc/700.css'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { ApiError, friendlyMessage } from '../api/errors'
import { DAILY_ARTWORK_LIMIT, DAILY_LIMIT_CODE, countToday, hoursUntilReset } from '../config/limits'
import type { Artwork, Background, CurrentUser, Policy } from '../api/types'
import BottomSheet from '../components/BottomSheet.vue'
import BadgeCelebration from '../components/BadgeCelebration.vue'
import Icon from '../components/Icon.vue'
import Segmented from '../components/Segmented.vue'
import { openLink } from '../composables/bridge'
import { announce } from '../composables/toast'
import { startDownload } from '../composables/artworkActions'
import { unlockAudio } from '../composables/sound'
import { draft, resetDraft } from '../editor/draft'
import { SIZE, alignOf, type Layout, type TextAlign } from '../editor/layout'
import { qrZone } from '../editor/qr'
import { HANDLE_R, exportPng, handlePoint, isTainted, layoutsFor, loadImage, loadLayerFonts, renderScene, styleSwatch } from '../editor/render'
import { GREETING, POSITIONS, SLOGAN } from '../editor/scene'
import { FONTS, GREETINGS, TEXT_STYLES, type FontKey } from '../editor/styles'
import { backgroundSrc, catalogBackgrounds, loadBackgroundCatalog, serverBackgroundId, type BackgroundItem } from '../data/backgrounds'
import { customPhoto, loadCustomPhoto, photoErrorMessage } from '../editor/customPhoto'

type Tool = 'bg' | 'policy' | 'text' | 'style'
type CreateStep = 'start' | 'preview' | 'edit'
const router = useRouter()
const createStep = ref<CreateStep>('start')
const starterReady = ref(false)
const starterImage = new URL('backgrounds/taipei101-sunset.jpg', document.baseURI).href

const tool = ref<Tool>(draft.policy ? 'text' : 'bg')
const tools = [
  { value: 'bg' as const, label: '背景', icon: 'image' },
  { value: 'policy' as const, label: '政策', icon: 'flag' },
  { value: 'text' as const, label: '內容', icon: 'text' },
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
/** 對齊：橫書是靠左／置中／靠右，直書是靠上／置中／靠下 */
const alignOptions = computed(() =>
  layer.value.vertical
    ? [
        { value: 'start' as TextAlign, label: '靠上', icon: 'align-top' },
        { value: 'center' as TextAlign, label: '置中', icon: 'align-middle' },
        { value: 'end' as TextAlign, label: '靠下', icon: 'align-bottom' },
      ]
    : [
        { value: 'start' as TextAlign, label: '靠左', icon: 'align-left' },
        { value: 'center' as TextAlign, label: '置中', icon: 'align-center' },
        { value: 'end' as TextAlign, label: '靠右', icon: 'align-right' },
      ],
)
const layerAlign = computed<TextAlign>({
  get: () => alignOf(layer.value),
  set: (v) => {
    layer.value.align = v
  },
})

const me = ref<CurrentUser | null>(null)
const backgrounds = ref<Background[]>([])
/** 後端的背景清單：只用來決定儲存時送哪個 backgroundId（畫面上的背景由前端圖庫決定） */
const serverBackgrounds = ref<Background[]>([])
/** 前端圖庫有資料就用圖庫（依使用者作品數解鎖）；圖庫載入失敗才退回後端清單 */
const buildBackgrounds = (server: Background[], artworkCount: number) =>
  catalog.value.length ? catalogBackgrounds(catalog.value, artworkCount) : server
/** 前端背景圖庫（照片、解鎖門檻） */
const catalog = ref<BackgroundItem[]>([])
const currentBg = computed(() => backgrounds.value.find((b) => b.id === draft.backgroundId) ?? null)
const categories = ref<string[]>([])
const category = ref<string>(draft.policy?.category ?? '')
const policies = ref<Policy[]>([])
const loading = ref({ bg: true, cat: true, pol: false })
const loadError = ref<string | null>(null)
const saving = ref(false)
const pageMessage = ref<{ text: string; tone: 'info' | 'error' } | null>(null)

function showMessage(text: string, tone: 'info' | 'error' = 'info') {
  pageMessage.value = { text, tone }
  announce(text)
}

function clearMessage() {
  pageMessage.value = null
}

/* ---------------- 每日製作上限（台北時間，一天 DAILY_ARTWORK_LIMIT 張） ---------------- */
/** 今天已存幾張；null = 還不知道（載入中或查詢失敗，不擋使用者，交給後端判斷） */
const todayCount = ref<number | null>(null)
const remaining = computed(() => (todayCount.value == null ? null : Math.max(0, DAILY_ARTWORK_LIMIT - todayCount.value)))
const limitReached = computed(() => remaining.value === 0)
const limitMessage = computed(() => `今天的 ${DAILY_ARTWORK_LIMIT} 張做完了，${hoursUntilReset()} 小時後可以再做`)

async function loadTodayCount() {
  try {
    // 我的作品依時間新到舊，前 N 張就足以判斷今天是否已達上限
    const res = await api.listMyArtworks(0, DAILY_ARTWORK_LIMIT)
    todayCount.value = countToday(res.content.map((a) => a.createdAt))
  } catch {
    todayCount.value = null
  }
}
const randomizing = ref(false)
const showQrZone = ref(true)
const bgTainted = ref(false)
const saved = ref<{
  artwork: Artwork
  before: CurrentUser | null
  after: CurrentUser | null
  unlocked: Background[]
  /** 剛在手機上畫好的那張圖（blob URL）：不用再從網路下載，打開視窗就是完整的圖 */
  preview: string
} | null>(null)
// 視窗關掉或換下一張時，釋放上一張預覽圖的記憶體
watch(saved, (_now, before) => {
  if (before?.preview && before.preview !== _now?.preview) URL.revokeObjectURL(before.preview)
})

/** 先把圖片解碼好，再打開視窗，避免圖片在視窗裡一段一段出現 */
async function decodedUrl(blob: Blob): Promise<string> {
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.src = url
  try {
    await img.decode()
  } catch {
    /* 舊瀏覽器沒有 decode()：照樣顯示，只是可能看到逐步載入 */
  }
  return url
}
/** 剛拿到的新徽章：有值時先顯示全螢幕慶祝畫面，關閉後才出現「儲存成功」視窗 */
const celebrate = ref<{ level: number; name: string } | null>(null)

const layer = computed(() => draft.layers[draft.selected])
const swatches = TEXT_STYLES.map((s) => ({ ...s, img: '' }))

async function selectFont(font: FontKey) {
  layer.value.font = font
  await loadLayerFonts([layer.value])
  draw()
}

/* ---------------- 畫布 ---------------- */
const canvas = ref<HTMLCanvasElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const editorEl = ref<HTMLElement | null>(null)

/* ---------------- 版面模式：釘住（預設）或整頁捲動 ---------------- */
const toolsEl = ref<HTMLElement | null>(null)
const actionEl = ref<HTMLElement | null>(null)
/**
 * flow = 整頁捲動。預覽、工具分頁、底部按鈕列都釘在畫面上時，工具區剩下的高度太小
 * （矮螢幕、字級放大、鍵盤彈出）就改成整頁捲動：分頁列與底部按鈕列仍然黏住，預覽圖跟著內容捲動。
 * 判斷只看「釘住時工具區會剩多高」，不看目前是哪個模式，所以不會來回跳動。
 */
const flow = ref(false)
/** 整頁捲動時，分頁列與底部按鈕列是否黏住：兩條加起來佔畫面一半以上（小螢幕＋大字）就不黏，整頁都拿來捲動 */
const stickyBars = ref(true)
/** 釘住時工具區至少要有這麼高（rem，隨字級放大）才維持釘住版面 */
const MIN_PANEL_REM = 11.5
const wideLayout =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(orientation: landscape) and (min-width: 640px), (min-width: 900px)')
    : null
let layoutRo: ResizeObserver | null = null

function updateLayoutMode() {
  const main = document.querySelector('main')
  const tools = toolsEl.value
  const action = actionEl.value
  const stageEl = stage.value
  if (!main || !tools || !action || !stageEl) return
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  // 釘住時預覽佔的高度：直式 = 34% 螢幕高（寬度不夠就以寬度為準）＋上下留白；橫式兩欄時預覽在左欄，不佔右欄高度
  const stageH = wideLayout?.matches ? 0 : Math.min(0.34 * window.innerHeight, stageEl.clientWidth - 32) + 16
  const panelH = main.clientHeight - stageH - tools.offsetHeight - action.offsetHeight
  flow.value = panelH < MIN_PANEL_REM * rem
  stickyBars.value = tools.offsetHeight + action.offsetHeight <= 0.45 * main.clientHeight
}
let ctx: CanvasRenderingContext2D | null = null
let layouts: Layout[] = []
let bgImage: HTMLImageElement | null = null
let raf = 0
let ro: ResizeObserver | null = null
const imgCache = new Map<string, Promise<HTMLImageElement>>()
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
    layouts = renderScene(
      ctx,
      { background: activeBg(), layers: draft.layers },
      {
        selected: createStep.value === 'start' ? null : draft.selected,
        qrZone: createStep.value === 'edit' && showQrZone.value ? qrZone() : null,
      },
    )
  })
}

/** 背景圖片網址：前端圖庫有同名照片就用本地照片，否則用後端的 imageUrl */
const bgSrc = (bg: Background) => backgroundSrc(bg, catalog.value)

function getImage(bg: Background) {
  const src = bgSrc(bg)
  let p = imgCache.get(src)
  if (!p) {
    p = loadImage(src)
    p.catch(() => imgCache.delete(src))
    imgCache.set(src, p)
  }
  return p
}

watch(
  () => [draft.backgroundId, backgrounds.value, catalog.value] as const,
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
      showMessage('背景圖載入失敗，請換一張或稍後再試', 'error')
    }
  },
)
watch(() => [draft.layers, draft.selected, showQrZone.value, customPhoto.value], draw, { deep: true })
/** 直書／橫書切換時，文字框的寬高意義互換，清掉讓它重新依文字自動決定 */
watch(
  () => draft.layers.map((l) => l.vertical),
  (now, before) => {
    now.forEach((v, i) => {
      if (before && before[i] !== v) {
        delete draft.layers[i].boxW
        delete draft.layers[i].boxH
      }
    })
  },
)

/* ---------------- 拖曳文字：拖框移動、拖右下角把手縮放 ---------------- */
type Drag =
  | { mode: 'move'; idx: number; dx: number; dy: number; id: number }
  | {
      mode: 'resize'
      idx: number
      cx: number
      cy: number
      startRadius: number
      startSize: number
      startW: number
      startH: number
      id: number
    }
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
  if (createStep.value === 'start') return
  e.preventDefault()
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
      // 拖右下角把手時，文字框與字體一起等比例縮放。
      const pad = sel.fontSize * 0.25
      drag = {
        mode: 'resize',
        idx: draft.selected,
        cx,
        cy,
        startRadius: Math.max(1, Math.hypot(sel.box.w / 2, sel.box.h / 2)),
        startSize: l.size,
        startW: Math.max(sel.fontSize * 1.1, sel.box.w - 2 * pad),
        startH: Math.max(sel.fontSize * 1.1, sel.box.h - 2 * pad),
        id: e.pointerId,
      }
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
  e.preventDefault()
  const p = toScene(e)
  const l = draft.layers[drag.idx]
  if (drag.mode === 'resize') {
    // 以文字框中心為準等比例縮放，字體與文字框同步變大或變小。
    const maxBox = SIZE * 0.92
    const radius = Math.hypot(p.x - drag.cx, p.y - drag.cy)
    const requestedScale = radius / drag.startRadius
    const nextSize = Math.min(320, Math.max(40, Math.round(drag.startSize * requestedScale)))
    const scale = nextSize / drag.startSize
    l.size = nextSize
    l.boxW = Math.round(Math.min(maxBox, drag.startW * scale))
    l.boxH = Math.round(Math.min(maxBox, drag.startH * scale))
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
  announce('載入中')
  try {
    const [u, server, cats, cat] = await Promise.all([
      api.getCurrentUser(),
      api.listBackgrounds(),
      api.listPolicyCategories(),
      // 圖庫載入失敗就退回後端的背景清單
      loadBackgroundCatalog().catch(() => null),
    ])
    if (cat) catalog.value = cat.backgrounds
    me.value = u
    serverBackgrounds.value = server
    const bgs = buildBackgrounds(server, u.artworkCount)
    backgrounds.value = bgs
    categories.value = cats
    if (draft.backgroundId == null || !bgs.some((b) => b.id === draft.backgroundId && b.unlocked)) {
      draft.backgroundId = bgs.find((b) => b.unlocked)?.id ?? null
    }
    if (!category.value || !cats.includes(category.value)) category.value = cats[0] ?? ''
    loadTodayCount()
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
    showMessage(friendlyMessage(e), 'error')
  } finally {
    loading.value.pol = false
  }
})

/* ---------------- 操作 ---------------- */
function pickBackground(b: Background) {
  if (!b.unlocked) {
    const need = b.unlockThreshold - (me.value?.artworkCount ?? 0)
    showMessage(`再儲存 ${Math.max(1, need)} 張作品就能解鎖「${b.name}」`)
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
    showMessage('已換成你的照片')
  } catch (err) {
    showMessage(photoErrorMessage(err), 'error')
  } finally {
    photoLoading.value = false
  }
}

function pickPolicy(p: Policy) {
  draft.policy = p
  draft.layers[SLOGAN].text = p.slogan
  draft.selected = SLOGAN
  showMessage(`已套用「${p.title}」標語`)
}

/**
 * 政策標語不能修改：畫面上的標語永遠等於所選政策的 slogan。
 * 舊版草稿（曾經可以改標語）或任何地方改到標語文字時，都還原成政策原文。
 */
watch(
  () => [draft.policy?.slogan, draft.layers[SLOGAN].text] as const,
  ([slogan, text]) => {
    if (slogan != null && text !== slogan) draft.layers[SLOGAN].text = slogan
  },
  { immediate: true },
)

const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)]

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function boxesOverlap(a: Layout['box'], b: Layout['box'], gap = 24) {
  return !(a.x + a.w + gap <= b.x || b.x + b.w + gap <= a.x || a.y + a.h + gap <= b.y || b.y + b.h + gap <= a.y)
}

/** 兩段文字各自隨機放進不同九宮格；用實際字體量測，確保文字框不重疊。 */
function placeLayersOnGrid(greeting: typeof draft.layers[number], slogan: typeof draft.layers[number]) {
  delete greeting.boxW
  delete greeting.boxH
  delete slogan.boxW
  delete slogan.boxH

  const measureCanvas = document.createElement('canvas')
  measureCanvas.width = SIZE
  measureCanvas.height = SIZE
  const measureContext = measureCanvas.getContext('2d')
  if (!measureContext) return

  const pairs = shuffled(
    POSITIONS.flatMap((first, firstIndex) =>
      POSITIONS.filter((_, secondIndex) => firstIndex !== secondIndex).map((second) => [first, second] as const),
    ),
  )

  const fits = (first: (typeof POSITIONS)[number], second: (typeof POSITIONS)[number]) => {
    Object.assign(greeting, { x: first.x, y: first.y })
    Object.assign(slogan, { x: second.x, y: second.y })
    const [greetingLayout, sloganLayout] = layoutsFor(measureContext, [greeting, slogan])
    const reservedQr = qrZone()
    return (
      !boxesOverlap(greetingLayout.box, sloganLayout.box) &&
      !boxesOverlap(greetingLayout.box, reservedQr, 12) &&
      !boxesOverlap(sloganLayout.box, reservedQr, 12)
    )
  }

  if (pairs.some(([first, second]) => fits(first, second))) return

  // 極長文字找不到空位時，固定放上、下兩格並逐步縮小，直到不重疊。
  const top = POSITIONS[1]
  const bottom = POSITIONS[7]
  while (!fits(top, bottom) && (greeting.size > 40 || slogan.size > 40)) {
    greeting.size = Math.max(40, greeting.size - 8)
    slogan.size = Math.max(40, slogan.size - 8)
  }
}

async function randomize(): Promise<boolean> {
  clearMessage()
  randomizing.value = true
  try {
    const p = await api.getRandomPolicy()
    draft.policy = p
    category.value = p.category
    const unlocked = backgrounds.value.filter((b) => b.unlocked)
    if (unlocked.length) {
      customPhoto.value = null
      const nextBackground = pick(unlocked)
      draft.backgroundId = nextBackground.id
      const image = await getImage(nextBackground)
      if (draft.backgroundId === nextBackground.id) {
        bgImage = image
        bgTainted.value = isTainted(image)
      }
    }
    const [g, s] = draft.layers
    g.text = pick(GREETINGS)
    g.vertical = Math.random() < 0.6
    g.styleId = pick(TEXT_STYLES).id
    s.text = p.slogan
    s.styleId = pick(TEXT_STYLES.filter((t) => t.id !== g.styleId)).id
    await loadLayerFonts([g, s])
    placeLayersOnGrid(g, s)
    draft.selected = SLOGAN
    return true
  } catch (e) {
    showMessage(friendlyMessage(e), 'error')
    return false
  } finally {
    randomizing.value = false
  }
}

async function makeSuggested() {
  if (!(await randomize())) return
  createStep.value = 'preview'
  announce('長輩圖做好了，請確認預覽')
}

function openEditor() {
  tool.value = 'bg'
  createStep.value = 'edit'
  announce('已開啟自行調整工具')
}

const missing = computed(() => {
  if (!draft.backgroundId) return '請先選一張背景'
  if (!draft.policy) return '請先選一個要宣傳的政策'
  if (!draft.layers[SLOGAN].text.trim()) return '政策標語不能空白'
  if (draft.layers[SLOGAN].text.length > 500) return '標語最多 500 字'
  return null
})

/** 底部提示：已達上限 > 還缺什麼 > 今天還剩幾張 */
const saveHint = computed(() => {
  if (limitReached.value) return limitMessage.value
  if (missing.value) return missing.value
  return null
})

async function save() {
  // 儲存後若拿到新徽章會播慶祝音效；瀏覽器要在「點擊當下」才允許解鎖聲音，所以放在最前面
  unlockAudio()
  clearMessage()
  if (limitReached.value) {
    showMessage(limitMessage.value)
    return
  }
  if (missing.value) {
    showMessage(missing.value)
    if (!draft.backgroundId) tool.value = 'bg'
    else if (!draft.policy) tool.value = 'policy'
    else tool.value = 'text'
    return
  }
  saving.value = true
  try {
    const bgDrawable = activeBg()
    if (!bgDrawable) {
      showMessage('背景照片還沒載入完成，請稍等一下再按儲存')
      return
    }
    if (isTainted(bgDrawable)) {
      showMessage('這張背景照片無法輸出，請換一張背景再儲存', 'error')
      return
    }
    let blob: Blob
    try {
      await loadLayerFonts(draft.layers)
      blob = await exportPng({ background: bgDrawable, layers: draft.layers })
    } catch {
      showMessage('這張背景無法輸出圖片，請換一張背景再試', 'error')
      return
    }
    if (blob.size > 10 * 1024 * 1024) {
      showMessage('圖片超過 10 MB，請換一張背景再試', 'error')
      return
    }
    const before = me.value
    const backendBgId = serverBackgroundId(currentBg.value?.name, serverBackgrounds.value)
    if (backendBgId == null) {
      showMessage('目前沒有可用的背景資料，請稍後再試', 'error')
      return
    }
    const artwork = await api.createArtwork({
      image: blob,
      backgroundId: backendBgId,
      policyId: draft.policy!.id,
      sloganText: draft.policy!.slogan,
    })
    const [after, server] = await Promise.all([api.getCurrentUser(), api.listBackgrounds()]).catch(
      () => [null, serverBackgrounds.value] as const,
    )
    // 依這位使用者存檔後的作品數重算解鎖，找出這次新解鎖的背景
    const bgs = buildBackgrounds(server, after?.artworkCount ?? (me.value?.artworkCount ?? 0) + 1)
    const unlocked = bgs.filter((b) => b.unlocked && backgrounds.value.some((o) => o.id === b.id && !o.unlocked))
    me.value = after ?? me.value
    serverBackgrounds.value = server
    backgrounds.value = bgs
    if (todayCount.value != null) todayCount.value += 1
    // 「儲存中…」一直維持到預覽圖解碼完成，視窗一打開就是完整的圖
    const preview = await decodedUrl(blob)
    saved.value = { artwork, before, after, unlocked, preview }
    const gained = after?.badge
    if (gained && gained.level !== before?.badge?.level) celebrate.value = { level: gained.level, name: gained.name }
  } catch (e) {
    // 後端說今天已滿（例如在別支手機做過）：同步前端狀態
    if (e instanceof ApiError && e.code === DAILY_LIMIT_CODE) todayCount.value = DAILY_ARTWORK_LIMIT
    // 草稿保留，使用者可以直接再按一次儲存
    showMessage(friendlyMessage(e), 'error')
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
  createStep.value = 'start'
  tool.value = 'bg'
}

async function useUnlocked(b: Background) {
  saved.value = null
  customPhoto.value = null
  draft.backgroundId = b.id
  createStep.value = 'edit'
  tool.value = 'bg'
  await nextTick()
  sizeCanvas()
}

watch(createStep, async (step) => {
  if (step === 'start') return
  await nextTick()
  sizeCanvas()
  ro?.disconnect()
  if (typeof ResizeObserver !== 'undefined' && stage.value) {
    ro = new ResizeObserver(() => sizeCanvas())
    ro.observe(stage.value)
  }
  if (step === 'edit') {
    updateLayoutMode()
    if (typeof ResizeObserver !== 'undefined') {
      layoutRo?.disconnect()
      layoutRo = new ResizeObserver(updateLayoutMode)
      for (const el of [document.querySelector('main'), toolsEl.value, actionEl.value]) if (el) layoutRo.observe(el)
    }
  }
})

onMounted(() => {
  swatches.forEach((s) => (s.img = styleSwatch(s.id)))
  document.fonts?.addEventListener('loadingdone', draw)
  sizeCanvas()
  if (typeof ResizeObserver !== 'undefined' && stage.value) {
    ro = new ResizeObserver(() => sizeCanvas())
    ro.observe(stage.value)
  } else {
    window.addEventListener('resize', sizeCanvas)
  }
  // 版面模式：螢幕尺寸、鍵盤、字級（分頁列與按鈕列的高度會跟著變）改變時重新判斷
  updateLayoutMode()
  if (typeof ResizeObserver !== 'undefined') {
    layoutRo = new ResizeObserver(updateLayoutMode)
    for (const el of [document.querySelector('main'), toolsEl.value, actionEl.value]) if (el) layoutRo.observe(el)
  }
  window.addEventListener('resize', updateLayoutMode)
  window.visualViewport?.addEventListener('resize', updateLayoutMode)
  loadAll()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  layoutRo?.disconnect()
  window.removeEventListener('resize', sizeCanvas)
  window.removeEventListener('resize', updateLayoutMode)
  window.visualViewport?.removeEventListener('resize', updateLayoutMode)
  document.fonts?.removeEventListener('loadingdone', draw)
})

const canvasLabel = computed(() => {
  const g = draft.layers[GREETING].text.replace(/\n/g, ' ')
  const s = draft.layers[SLOGAN].text.replace(/\n/g, ' ')
  const bg = customPhoto.value ? '我的照片' : (backgrounds.value.find((b) => b.id === draft.backgroundId)?.name ?? '預設天空')
  return `長輩圖預覽：背景「${bg}」，問候語「${g || '無'}」，標語「${s || '尚未選擇'}」`
})
</script>

<template>
  <div ref="editorEl" class="create-page">
    <section v-if="createStep === 'start'" class="quick-start" aria-labelledby="create-question">
      <div class="quick-copy">
        <h2 id="create-question">今天想傳張圖嗎？</h2>
        <p>背景、問候語和政策都幫你配好</p>
      </div>

      <div class="starter-art" :class="{ ready: starterReady }" aria-hidden="true">
        <span v-if="!starterReady" class="starter-placeholder skeleton" />
        <img :src="starterImage" alt="" width="1080" height="1080" @load="starterReady = true" />
        <span class="starter-words">平安喜樂<br />天天好心情</span>
      </div>

      <div v-if="loadError" class="quick-error" role="alert">
        <p>{{ loadError }}</p>
        <button class="btn block" type="button" @click="loadAll"><Icon name="refresh" /> 重新載入</button>
      </div>
      <button
        v-else
        type="button"
        class="btn primary block large quick-primary"
        :class="{ 'limit-full': limitReached }"
        :disabled="randomizing || loading.bg || loading.cat || limitReached"
        @click="makeSuggested"
      >
        <Icon name="sparkle" :size="24" />
        {{ randomizing ? '正在幫你做…' : limitReached ? '今天已做滿' : '幫我做一張' }}
      </button>
      <p
        v-if="pageMessage"
        class="inline-feedback small"
        :class="{ error: pageMessage.tone === 'error' }"
        :role="pageMessage.tone === 'error' ? 'alert' : 'status'"
      >
        {{ pageMessage.text }}
      </p>
      <p v-if="limitReached" class="small muted" role="status">{{ limitMessage }}</p>
    </section>

    <div
      v-else
      :class="createStep === 'edit' ? ['editor', { flow, sticky: flow && stickyBars }] : 'quick-preview'"
    >
      <div v-if="createStep === 'preview'" class="quick-heading">
        <h2>這張可以嗎？</h2>
        <p class="small muted">可以直接儲存，或再換一張</p>
      </div>

    <div ref="stage" class="stage">
      <canvas
        ref="canvas"
        class="canvas editable"
        role="img"
        :aria-label="canvasLabel"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
      />
      <p class="drag-hint small muted">拖曳文字調整位置，拖右下角圓點縮放</p>
    </div>

    <div v-if="createStep === 'preview'" class="preview-panel">
      <p
        v-if="pageMessage"
        class="inline-feedback small"
        :class="{ error: pageMessage.tone === 'error' }"
        :role="pageMessage.tone === 'error' ? 'alert' : 'status'"
      >
        {{ pageMessage.text }}
      </p>
      <p class="one-line" :id="saveHint ? 'preview-save-hint' : undefined" aria-live="polite">{{ saveHint ?? '' }}</p>
      <div class="preview-main-actions">
        <button type="button" class="btn" :disabled="randomizing || !!loadError" @click="randomize">
          <Icon name="refresh" :size="20" /> {{ randomizing ? '挑選中…' : '換一張' }}
        </button>
        <button
          type="button"
          class="btn primary"
          :class="{ 'limit-full': limitReached }"
          :disabled="saving || !!loadError || limitReached"
          :aria-describedby="saveHint ? 'preview-save-hint' : undefined"
          @click="save"
        >
          <Icon name="save" :size="20" /> {{ saving ? '儲存中…' : '儲存' }}
        </button>
      </div>
      <button type="button" class="btn block preview-edit" @click="openEditor">
        <Icon name="brush" :size="20" /> 自行調整
      </button>
    </div>

    <div v-else class="right">
    <div ref="toolsEl" class="tools">
      <Segmented v-model="tool" :options="tools" label="編輯工具" mode="tabs" id-prefix="tool" />
    </div>
    <p
      v-if="pageMessage"
      class="inline-feedback editor-feedback small"
      :class="{ error: pageMessage.tone === 'error' }"
      :role="pageMessage.tone === 'error' ? 'alert' : 'status'"
    >
      {{ pageMessage.text }}
    </p>

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
      <p v-if="bgTainted" class="notice small">這張照片無法輸出，請換一張背景</p>
      <input ref="photoInput" type="file" accept="image/*" class="visually-hidden" tabindex="-1" aria-hidden="true" @change="onPhotoPicked" />
      <div v-if="loading.bg" class="bg-grid">
        <div v-for="i in 6" :key="i" class="bg-item skeleton" />
      </div>
      <div v-else class="bg-grid" role="radiogroup" aria-label="選擇背景">
        <button
          type="button"
          role="radio"
          class="bg-item mine"
          :class="{ on: !!customPhoto }"
          :aria-checked="!!customPhoto"
          :aria-label="customPhoto ? '我的照片（再按一次換一張）' : '用自己的照片'"
          :disabled="photoLoading"
          @click="choosePhoto"
        >
          <img v-if="customPhoto" :src="customPhoto.thumb" alt="" />
          <span v-else class="mine-icon" aria-hidden="true"><Icon name="camera" :size="32" /></span>
          <span class="bg-name">{{ photoLoading ? '讀取中…' : '我的照片' }}</span>
          <span v-if="customPhoto" class="tick"><Icon name="check" :size="18" /></span>
        </button>
        <button
          v-for="b in backgrounds"
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
          <img :src="bgSrc(b)" alt="" loading="lazy" decoding="async" @error="($event.target as HTMLImageElement).classList.add('broken')" />
          <span class="bg-name">{{ b.name }}</span>
          <span v-if="!b.unlocked" class="lock">
            <Icon name="lock" :size="22" />
            <span>存 {{ b.unlockThreshold }} 張解鎖</span>
          </span>
          <span v-if="!customPhoto && draft.backgroundId === b.id" class="tick"><Icon name="check" :size="18" /></span>
        </button>
      </div>
    </section>

    <!-- 政策 -->
    <section
      v-else-if="tool === 'policy'"
      id="tool-panel-policy"
      class="panel"
      role="tabpanel"
      aria-labelledby="tool-tab-policy"
    >
      <label class="field">
        <h2 class="panel-title">1. 選政策類別</h2>
        <span class="select-wrap">
          <select v-model="category" class="select" :disabled="loading.cat || !categories.length">
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
          <Icon name="chevron-right" class="select-arrow" />
        </span>
      </label>
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
      <!-- 會開啟外部網頁，用連結（不是按鈕）讓讀報軟體唸成「連結」 -->
      <a
        v-if="draft.policy"
        :href="draft.policy.sourceUrl"
        target="_blank"
        rel="noopener"
        class="btn text block source"
        @click.prevent="openLink(draft.policy.sourceUrl)"
      >
        <Icon name="link" :size="20" /> 看「{{ draft.policy.title }}」政策說明
      </a>
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
          <h2 class="field-label">問候語</h2>
          <textarea v-model="layer.text" class="text-box" rows="2" maxlength="40" />
        </label>
      </template>
      <template v-else>
        <p v-if="!draft.policy" class="notice small">
          先到「政策」選一個政策，標語會自動帶進來
          <button type="button" class="btn text" @click="tool = 'policy'">去選政策</button>
        </p>
        <div v-else class="field">
          <h2 class="field-label">政策標語</h2>
          <p class="text-box" aria-describedby="slogan-help">{{ draft.policy.slogan }}</p>
          <span id="slogan-help" class="small muted">標語由市府提供，不能修改</span>
        </div>
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
          :aria-label="s.name"
          :aria-checked="layer.styleId === s.id"
          @click="layer.styleId = s.id"
        >
          <img :src="s.img" alt="" width="60" height="60" />
        </button>
      </div>

      <h2 class="panel-title">排列</h2>
      <div class="arrange">
        <Segmented v-model="layer.vertical" :options="orientOptions" label="文字方向" icon-only />
        <Segmented v-model="layerAlign" :options="alignOptions" label="對齊" icon-only />
      </div>

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
          @click="selectFont(f.key)"
        >
          {{ f.name }}
        </button>
      </div>

      <label class="switch-row list-row">
        <span class="grow">
          標出 <span lang="en">QR Code</span> 的位置
        </span>
        <span class="switch-state" aria-hidden="true">{{ showQrZone ? '開' : '關' }}</span>
        <input v-model="showQrZone" type="checkbox" role="switch" class="switch" />
      </label>

      <button type="button" class="btn text block" @click="resetDraft(true)">
        <Icon name="undo" :size="20" /> 文字全部重來
      </button>
    </section>


    <!-- Figma Section_one line text_button/m：固定在畫面底部，按鈕不會被捲走 -->
    <div ref="actionEl" class="section-bar actionbar">
      <p class="one-line" :id="saveHint ? 'save-hint' : undefined" aria-live="polite">{{ saveHint ?? '' }}</p>
      <div class="btns">
        <button type="button" class="btn" :disabled="randomizing || !!loadError" @click="randomize">
          <Icon name="dice" :size="20" /> {{ randomizing ? '挑選中…' : '隨機一張' }}
        </button>
        <button
          type="button"
          class="btn primary"
          :class="{ 'limit-full': limitReached }"
          :disabled="saving || !!loadError || limitReached"
          :aria-describedby="saveHint ? 'save-hint' : undefined"
          @click="save"
        >
          <Icon name="save" :size="20" /> {{ saving ? '儲存中…' : limitReached ? '今天已做滿' : '儲存作品' }}
        </button>
      </div>
    </div>
    </div>
    </div>

    <BadgeCelebration :badge="celebrate" @close="celebrate = null" />

    <BottomSheet :open="!!saved && !celebrate" title="完成" @close="saved = null">
      <div v-if="saved" class="saved">
        <img class="saved-img" :src="saved.preview" width="1080" height="1080" alt="剛儲存的長輩圖" />
        <p class="saved-count"><strong>作品已儲存</strong></p>
        <p v-if="remaining != null" class="saved-left small muted">
          {{ remaining > 0 ? `今天還能再做 ${remaining} 張` : `今天的 ${DAILY_ARTWORK_LIMIT} 張做完了，明天再來！` }}
        </p>
        <div v-for="b in saved.unlocked" :key="b.id" class="reward">
          <span class="reward-title">解鎖新背景「{{ b.name }}」</span>
          <button type="button" class="btn" @click="useUnlocked(b)">馬上用</button>
        </div>
        <div class="saved-actions">
          <button type="button" class="btn primary block large" @click="saveToPhone">
            <Icon name="share" :size="20" /> 分享給親友
          </button>
          <button v-if="!limitReached" type="button" class="btn block large" @click="makeAnother">再做一張</button>
          <button type="button" class="btn text block" @click="router.push('/me')">看我的作品</button>
        </div>
      </div>
    </BottomSheet>
  </div>
</template>

<style scoped>
.create-page {
  height: 100%;
  min-height: 0;
}
.quick-start,
.quick-preview {
  width: min(100%, 560px);
  min-height: 100%;
  margin: 0 auto;
  padding: 20px 20px max(20px, env(safe-area-inset-bottom));
}
.quick-start {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}
.quick-copy,
.quick-heading {
  width: 100%;
}
.quick-copy h2,
.quick-heading h2 {
  font-size: var(--tp-font-h2);
  line-height: var(--tp-lh-h2);
  font-weight: 600;
}
.quick-copy p {
  margin-top: 6px;
  color: var(--c-text-2);
  font-size: var(--tp-font-h3);
  line-height: var(--tp-lh-h3);
}
.starter-art {
  position: relative;
  width: min(100%, 40vh, 420px);
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radius-l);
  background: var(--tp-grey-100);
  box-shadow: var(--shadow-1);
}
@supports (height: 1svh) {
  .starter-art {
    width: min(100%, 40svh, 420px);
  }
}
.starter-placeholder {
  position: absolute;
  inset: 0;
}
.starter-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 160ms ease-out;
}
.starter-art.ready img {
  opacity: 1;
}
.starter-words {
  position: absolute;
  left: 6%;
  bottom: 7%;
  color: var(--c-like);
  font-size: clamp(1.5rem, 8vw, 2.5rem);
  line-height: 1.2;
  font-weight: 600;
  text-shadow:
    -2px -2px 0 #fff,
    2px -2px 0 #fff,
    -2px 2px 0 #fff,
    2px 2px 0 #fff;
}
.quick-primary,
.quick-error {
  width: min(100%, 420px);
}
.quick-primary {
  min-height: 56px;
  margin-top: auto;
}
.quick-error {
  display: grid;
  gap: 10px;
  text-align: center;
}
.quick-preview {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.quick-heading p {
  margin-top: 4px;
}
.quick-preview .stage {
  padding: 0;
  background: transparent;
}
.quick-preview .canvas {
  width: min(100%, 34vh, 440px);
  border-radius: var(--radius-l);
}
@supports (height: 1svh) {
  .quick-preview .canvas {
    width: min(100%, 34svh, 440px);
  }
}
.preview-panel {
  width: min(100%, 440px);
  margin: auto auto 0;
  display: grid;
  gap: 12px;
}
.preview-main-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.preview-edit {
  background: var(--c-surface);
  color: var(--c-text);
  border-color: var(--tp-grey-400);
}
.inline-feedback {
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-s);
  background: var(--tp-primary-50);
  color: var(--tp-primary-800);
  text-align: center;
}
.inline-feedback.error {
  background: var(--tp-red-300);
  color: var(--tp-grey-950);
}
.editor-feedback {
  flex: none;
  border-radius: 0;
}
.canvas:not(.editable) {
  touch-action: pan-x pan-y pinch-zoom;
}
.canvas.editable {
  touch-action: none;
  cursor: grab;
}
.canvas.editable:active {
  cursor: grabbing;
}
.drag-hint {
  margin-top: 6px;
  text-align: center;
}

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

/*
 * 整頁捲動（flow）：矮螢幕、字級放大、鍵盤彈出時，工具區不被壓扁（見 script 的 updateLayoutMode）。
 * 預覽跟著內容捲動、縮小一點，兩側留白才好讓手指從旁邊滑動頁面；
 * 工具分頁黏在上方、底部按鈕列黏在下方，儲存永遠按得到。
 */
.editor.flow {
  height: auto;
  min-height: 100%;
  --canvas: min(100%, 32vh);
}
@supports (height: 1svh) {
  .editor.flow {
    --canvas: min(100%, 32svh);
  }
}
.editor.flow .right {
  flex: 1 0 auto;
}
.editor.flow .panel {
  flex: 1 0 auto;
  overflow: visible;
}
/* 分頁列與按鈕列黏住（兩條加起來沒佔掉畫面一半時才黏，見 script 的 stickyBars） */
.editor.flow.sticky .tools {
  position: sticky;
  top: 0;
  z-index: 6;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}
.editor.flow.sticky .actionbar {
  position: sticky;
  bottom: 0;
  z-index: 6;
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
  /* 兩欄 + 整頁捲動：左邊預覽黏在上方，右邊內容一路往下 */
  .editor.flow {
    align-items: start;
    --canvas: min(100%, calc(100vh - 160px));
  }
  @supports (height: 1svh) {
    .editor.flow {
      --canvas: min(100%, calc(100svh - 160px));
    }
  }
  .editor.flow .stage {
    position: sticky;
    top: 0;
  }
  .editor.flow .right {
    height: auto;
  }
}


/* 工具區的每個區塊維持原本高度，內容多就往下排、由工具區捲動，不會被壓扁截掉 */
.panel > * {
  flex-shrink: 0;
}
.panel-title {
  font-size: var(--tp-font-h3);
  line-height: var(--tp-lh-h3);
  font-weight: 600;
  margin-top: 6px;
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
  border: 1px solid transparent;
  background: var(--tp-grey-100);
  min-height: 48px;
}
.bg-item.mine {
  background: var(--tp-primary-50);
  color: var(--c-action);
}
.mine-icon {
  position: absolute;
  inset: 0 0 28px;
  display: flex;
  align-items: center;
  justify-content: center;
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
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.78));
  /* 名稱太長就用「…」截斷；完整名稱在按鈕的 aria-label 裡，讀報軟體唸得到 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
/* 政策標語預覽：完整顯示、自動換行，不截斷（字級放大時也不會少看到字） */
.row-sub {
  display: block;
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
h2.field-label {
  margin: 0;
  font-size: inherit;
}
/* 排列：方向（2 個圖示）＋對齊（3 個圖示）排在同一列，按鈕寬度一致 */
.arrange {
  display: grid;
  grid-template-columns: 2fr 3fr;
  gap: 10px;
}
/* 政策類別：原生下拉選單（手機會叫出系統的選擇器） */
.select-wrap {
  position: relative;
  display: block;
}
.select {
  appearance: none;
  -webkit-appearance: none;
  display: block;
  width: 100%;
  min-height: 52px;
  margin: 0;
  padding: 10px 48px 10px 14px;
  border-radius: var(--radius-m);
  background: var(--tp-grey-50);
  border: 1px solid var(--tp-grey-200);
  font: inherit;
  font-size: var(--tp-font-h3);
  line-height: var(--tp-lh-h3);
  color: var(--c-text);
}
.select:focus-visible {
  outline: 3px solid var(--c-focus);
  outline-offset: 2px;
}
.select:disabled {
  opacity: 0.6;
}
.select-arrow {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%) rotate(90deg);
  pointer-events: none;
  color: var(--tp-grey-800);
}
/* 觸控裝置保留系統原生 select 外觀與選擇器。 */
@media (pointer: coarse), (max-width: 767px) {
  .select {
    appearance: auto;
    -webkit-appearance: menulist;
    padding-right: 14px;
  }
  .select-arrow {
    display: none;
  }
}
/* 問候語（可編輯）與政策標語（唯讀）共用同一種文字框 */
.text-box {
  display: block;
  width: 100%;
  margin: 0;
  padding: 12px 14px;
  border-radius: var(--radius-m);
  background: var(--tp-grey-50);
  border: 1px solid var(--tp-grey-200);
  font: inherit;
  font-size: var(--tp-font-h3);
  line-height: var(--tp-lh-h3);
  white-space: pre-line;
  color: var(--c-text);
  resize: none;
}
textarea.text-box {
  white-space: pre-wrap;
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
  border: 1px solid transparent;
  background: var(--c-surface);
}
.swatch img {
  width: 60px;
  height: 60px;
  border-radius: var(--radius-s);
}
.swatch[aria-checked='true'] {
  border-color: var(--c-action);
  background: var(--c-brand-soft);
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
  height: auto;
  /* 先保留正方形的位置，圖片出現時視窗不會跳動 */
  aspect-ratio: 1;
  margin: 0 auto;
  border-radius: var(--radius-m);
  box-shadow: var(--shadow-1);
}
.saved-count {
  text-align: center;
  font-size: var(--tp-font-h2);
  line-height: var(--tp-lh-h2);
}
.saved-left {
  text-align: center;
  margin-top: -6px;
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

/* 今日額度用完後維持單一停用色，不回應 hover 或按下狀態。 */
.btn.limit-full,
.btn.limit-full:hover,
.btn.limit-full:active {
  background: var(--c-disable);
  border-color: var(--c-disable);
  color: var(--tp-grey-600);
  box-shadow: none;
  transform: none;
  transition: none;
}

@media (min-width: 900px) and (orientation: landscape) {
  .editor {
    max-width: 1000px;
  }
}
</style>
