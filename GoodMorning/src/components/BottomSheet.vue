<script setup lang="ts">
/**
 * Figma Pop up（3:4934）：置中白卡、標題置中 H3 Semibold、底部按鈕。
 * Dialog 無障礙：有名稱、開啟時焦點移入、Tab 鎖在面板內、Esc 與遮罩可關閉、關閉後焦點回到觸發元件。
 */
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Icon from './Icon.vue'

const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
const panel = ref<HTMLElement | null>(null)
let returnFocus: HTMLElement | null = null
const titleId = `sheet-${Math.random().toString(36).slice(2, 8)}`

function focusables(): HTMLElement[] {
  if (!panel.value) return []
  return [
    ...panel.value.querySelectorAll<HTMLElement>('button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])'),
  ].filter((el) => !el.hasAttribute('disabled'))
}

function onKey(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  } else if (e.key === 'Tab') {
    const list = focusables()
    if (!list.length) return
    const first = list[0]
    const last = list[list.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

watch(
  () => props.open,
  async (o) => {
    if (o) {
      returnFocus = document.activeElement as HTMLElement | null
      document.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
      await nextTick()
      panel.value?.focus()
    } else {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      returnFocus?.focus?.()
    }
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="scrim" @click.self="emit('close')">
        <div ref="panel" class="sheet" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1">
          <div class="head">
            <h2 :id="titleId" class="sheet-title">{{ title }}</h2>
            <button class="close" type="button" aria-label="關閉" @click="emit('close')">
              <Icon name="close" />
            </button>
          </div>
          <div class="body">
            <slot />
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
  z-index: 100;
  background: rgba(11, 13, 14, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
}
.sheet {
  width: 100%;
  max-width: 400px;
  max-height: 100%;
  overflow-y: auto;
  background: var(--c-surface);
  border-radius: 8px;
  padding: 8px 16px 20px;
  outline: none;
}
.head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 44px;
}
.sheet-title {
  font-size: var(--tp-font-h3);
  line-height: var(--tp-lh-h3);
  font-weight: 600;
  color: var(--c-text);
  text-align: center;
}
.close {
  position: absolute;
  right: -8px;
  top: 0;
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--tp-grey-700);
}
.close:active {
  background: var(--tp-grey-50);
}
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.18s ease;
}
.sheet-enter-active .sheet,
.sheet-leave-active .sheet {
  transition: transform 0.18s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: scale(0.96);
}
</style>
