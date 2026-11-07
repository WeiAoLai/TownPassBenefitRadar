<script setup lang="ts">
/**
 * 原生風格底部面板（iOS action sheet / Android modal bottom sheet）。
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
          <div class="grabber" aria-hidden="true" />
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
  background: rgba(23, 27, 29, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: 100%;
  max-width: 600px;
  max-height: 92vh;
  overflow-y: auto;
  background: var(--c-surface);
  border-radius: var(--radius-l) var(--radius-l) 0 0;
  box-shadow: var(--shadow-sheet);
  padding: 8px 16px calc(20px + env(safe-area-inset-bottom));
  outline: none;
}
.grabber {
  width: 40px;
  height: 5px;
  border-radius: 3px;
  background: var(--tp-grey-200);
  margin: 0 auto 4px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.sheet-title {
  font-size: var(--tp-font-h3);
  font-weight: 600;
  padding-left: 4px;
}
.close {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--tp-grey-600);
}
.close:active {
  background: var(--tp-grey-50);
}
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s ease;
}
.sheet-enter-active .sheet,
.sheet-leave-active .sheet {
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateY(100%);
}
</style>
