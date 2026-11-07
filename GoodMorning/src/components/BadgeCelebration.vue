<script setup lang="ts">
/**
 * 獲得新徽章的全螢幕慶祝畫面：徽章轉圈放大登場、光芒與星星、大字恭喜、歡樂音效，並可分享給親友。
 * - 不自動消失，長輩要按大按鈕（或 Esc）才關閉，避免來不及看。
 * - 動畫只用在「進場」與緩慢的光芒／星星，沒有快速閃爍；prefers-reduced-motion 時 base.css 會關掉所有動畫，直接顯示最終畫面。
 * - 音效（合成音效＋隨機一句稱讚）預設開啟，右上角可關閉（記在手機上）；關閉本畫面時聲音立刻淡出。
 *   觸發本畫面的按鈕要先呼叫 unlockAudio()，見 composables/sound.ts。
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { badgeArtUrl } from '../config/badges'
import { shareApp, shareMessage, shareUrl } from '../composables/share'
import { playCelebration, setSound, soundOn, stopCelebration, unlockAudio } from '../composables/sound'
import Icon from './Icon.vue'

const props = defineProps<{ badge: { level: number; name: string } | null }>()
const emit = defineEmits<{ close: [] }>()

const okBtn = ref<HTMLButtonElement | null>(null)
const shareBtn = ref<HTMLButtonElement | null>(null)
const soundBtn = ref<HTMLButtonElement | null>(null)
const linkInput = ref<HTMLInputElement | null>(null)
const sharing = ref(false)
/** 沒有系統分享時改成複製連結：在按鈕下方顯示「已複製」 */
const copied = ref(false)
/** 分享與複製都失敗時，直接把連結顯示出來讓人長按複製 */
const manual = ref(false)
const manualText = computed(() => `${shareMessage(props.badge)}${shareUrl()}`)
let returnFocus: HTMLElement | null = null

/** 星星位置（百分比）與延遲，固定寫死讓畫面每次一樣 */
const sparkles = [
  { x: 12, y: 16, d: 0 },
  { x: 84, y: 12, d: 0.6 },
  { x: 24, y: 40, d: 1.2 },
  { x: 90, y: 38, d: 0.3 },
  { x: 8, y: 62, d: 0.9 },
  { x: 78, y: 64, d: 1.5 },
  { x: 36, y: 8, d: 1.8 },
  { x: 62, y: 30, d: 0.2 },
]

async function share() {
  if (sharing.value || !props.badge) return
  sharing.value = true
  copied.value = false
  manual.value = false
  try {
    const result = await shareApp(props.badge)
    copied.value = result === 'copied'
    if (result === 'manual') {
      manual.value = true
      await nextTick()
      linkInput.value?.focus()
      linkInput.value?.select()
    }
  } finally {
    sharing.value = false
  }
}

function toggleSound() {
  const on = !soundOn.value
  setSound(on)
  if (on) {
    unlockAudio()
    playCelebration()
  }
}

function focusables(): HTMLElement[] {
  const all: (HTMLElement | null)[] = [soundBtn.value, shareBtn.value, linkInput.value, okBtn.value]
  return all.filter((e): e is HTMLElement => e !== null)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  } else if (e.key === 'Tab') {
    // 焦點只在畫面上的幾個按鈕之間循環
    const list = focusables()
    if (!list.length) return
    const i = list.indexOf(document.activeElement as HTMLElement)
    const next = e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : i === list.length - 1 ? 0 : i + 1
    e.preventDefault()
    list[next].focus()
  }
}

function release() {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
  stopCelebration()
}

watch(
  () => props.badge,
  async (b, old) => {
    if (b && !old) {
      returnFocus = document.activeElement as HTMLElement | null
      manual.value = false
      copied.value = false
      document.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
      playCelebration()
      await nextTick()
      okBtn.value?.focus()
    } else if (!b && old) {
      release()
      returnFocus?.focus?.()
    }
  },
)

onBeforeUnmount(release)
</script>

<template>
  <Teleport to="body">
    <Transition name="celebrate">
      <div
        v-if="badge"
        class="scrim"
        role="dialog"
        aria-modal="true"
        :aria-label="`恭喜你獲得新徽章：Lv.${badge.level} ${badge.name}`"
      >
        <div class="rays" aria-hidden="true" />
        <span
          v-for="(s, i) in sparkles"
          :key="i"
          class="sparkle"
          aria-hidden="true"
          :style="{ left: s.x + '%', top: s.y + '%', animationDelay: s.d + 's' }"
          >✦</span
        >
        <button ref="soundBtn" type="button" class="sound" @click="toggleSound">
          <Icon :name="soundOn ? 'volume' : 'volume-off'" :size="24" />
          音效：{{ soundOn ? '開' : '關' }}
        </button>
        <div class="content">
          <div class="stage" aria-hidden="true">
            <img class="art" :src="badgeArtUrl(badge.level)" alt="" />
          </div>
          <div class="words">
            <p class="cheer">恭喜你！</p>
            <p class="sub">獲得新徽章</p>
            <p class="name">Lv.{{ badge.level }} {{ badge.name }}</p>
          </div>
          <div class="actions">
            <button ref="shareBtn" type="button" class="share" :disabled="sharing" @click="share">
              <Icon name="share" :size="26" /> 分享給親友
            </button>
            <p v-if="copied" class="copied" role="status">已複製，貼到 LINE 就能傳給親友</p>
            <div v-if="manual" class="manual">
              <label for="share-link">請複製下面的文字，貼到 LINE 傳給親友</label>
              <input id="share-link" ref="linkInput" class="link" type="text" readonly :value="manualText" @focus="($event.target as HTMLInputElement).select()" />
            </div>
            <button ref="okBtn" type="button" class="ok" @click="emit('close')">太棒了！</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 150;
  display: flex;
  overflow-y: auto;
  padding: max(20px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom));
  color: #fff;
  background: radial-gradient(circle at 50% 36%, var(--tp-primary-700) 0%, var(--tp-primary-800) 50%, var(--tp-grey-950) 100%);
}

/* 慢速旋轉的光芒，放在徽章後方 */
.rays {
  position: absolute;
  left: 50%;
  top: 36%;
  width: 170vmax;
  height: 170vmax;
  margin: -85vmax 0 0 -85vmax;
  pointer-events: none;
  background: repeating-conic-gradient(from 0deg, rgba(245, 186, 75, 0.3) 0deg 9deg, transparent 9deg 18deg);
  -webkit-mask-image: radial-gradient(circle, #000 0%, transparent 50%);
  mask-image: radial-gradient(circle, #000 0%, transparent 50%);
  animation: rays-turn 30s linear infinite;
}
@keyframes rays-turn {
  to {
    transform: rotate(360deg);
  }
}

.sparkle {
  position: absolute;
  font-size: 1.75rem;
  line-height: 1;
  color: var(--tp-secondary-300);
  pointer-events: none;
  animation: twinkle 2.6s ease-in-out infinite;
}
@keyframes twinkle {
  0%,
  100% {
    opacity: 0.25;
    transform: scale(0.7);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}

/* 音效開關：右上角，文字寫明「開／關」，不只靠圖示 */
.sound {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  right: 12px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 16px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.85);
  background: rgba(11, 13, 14, 0.45);
  color: #fff;
  font-size: var(--tp-font-body);
  font-weight: 600;
}
.sound:focus-visible,
.share:focus-visible,
.ok:focus-visible {
  outline-color: #fff;
}

.content {
  position: relative;
  /* auto 邊界：內容比畫面矮時置中，比畫面高時從頂端開始捲動，不會被切掉 */
  margin: auto;
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  text-align: center;
}

/* 登場：徽章轉兩圈（像硬幣翻轉）並由小放大；結束後輕輕上下浮動 */
.stage {
  perspective: 900px;
  animation: coin 1.9s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
}
@keyframes coin {
  from {
    transform: rotateY(-720deg) scale(0.15);
    opacity: 0;
  }
  55% {
    opacity: 1;
  }
}
.art {
  display: block;
  width: min(72vw, 36vh, 340px);
  aspect-ratio: 1;
  object-fit: contain;
  filter: drop-shadow(0 14px 28px rgba(0, 0, 0, 0.5));
  animation: float 3.2s ease-in-out 1.9s infinite;
}
@keyframes float {
  50% {
    transform: translateY(-10px);
  }
}

.words {
  display: flex;
  flex-direction: column;
  gap: 4px;
  animation: rise 0.7s ease-out 1.3s backwards;
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
}
.cheer {
  font-size: var(--tp-font-h1);
  line-height: var(--tp-lh-h1);
  font-weight: 600;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}
.sub {
  font-size: var(--tp-font-h2);
  line-height: var(--tp-lh-h2);
}
.name {
  font-size: var(--tp-font-h2);
  line-height: var(--tp-lh-h2);
  font-weight: 600;
  color: var(--tp-secondary-300);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

/* 兩顆按鈕：分享在上、「太棒了！」在最下面 */
.actions {
  width: min(100%, 320px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: rise 0.7s ease-out 1.6s backwards;
}
.share,
.ok {
  width: 100%;
  /* 與 .btn 一致：外觀最小高度 38、圓角 8；::after 把可點範圍撐到 48 */
  position: relative;
  min-height: 38px;
  border-radius: var(--radius-s);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: var(--tp-font-h3);
  line-height: var(--tp-lh-h3);
  font-weight: 600;
}
.share::after,
.ok::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: max(100%, 48px);
  transform: translateY(-50%);
}
/* 分享：白框透明底，白字對深色底約 12:1 */
.share {
  border: 1px solid #fff;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
.share:active {
  background: rgba(255, 255, 255, 0.28);
}
.share:disabled {
  opacity: 0.7;
}
/* 深色底上用金黃按鈕：深字對金黃約 10:1，比主色白字清楚 */
.ok {
  background: var(--tp-secondary-500);
  color: var(--tp-grey-950);
}
.ok:active {
  background: var(--tp-secondary-300);
}

.copied {
  font-size: var(--tp-font-h3);
  line-height: var(--tp-lh-h3);
  font-weight: 600;
  color: var(--tp-secondary-300);
  text-align: center;
}
.manual {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
  font-size: var(--tp-font-body);
  line-height: var(--tp-lh-body);
}
.link {
  width: 100%;
  min-height: 38px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #fff;
  background: #fff;
  color: var(--tp-grey-950);
  font-size: var(--tp-font-body);
}

.celebrate-enter-active,
.celebrate-leave-active {
  transition: opacity 0.25s ease;
}
.celebrate-enter-from,
.celebrate-leave-to {
  opacity: 0;
}
</style>
