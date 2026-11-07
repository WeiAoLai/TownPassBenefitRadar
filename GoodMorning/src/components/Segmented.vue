<script setup lang="ts" generic="T extends string | number | boolean">
/**
 * 原生風格分段控制（iOS UISegmentedControl）。
 * mode="tabs" 時為 tablist（搭配 tabpanel）；mode="radio" 時為 radiogroup。方向鍵可切換。
 */
import Icon from './Icon.vue'

const props = withDefaults(
  defineProps<{
    options: { value: T; label: string; icon?: string }[]
    modelValue: T
    label: string
    mode?: 'tabs' | 'radio'
    idPrefix?: string
  }>(),
  { mode: 'radio', idPrefix: 'seg' },
)
const emit = defineEmits<{ 'update:modelValue': [T] }>()

function onKey(e: KeyboardEvent, i: number) {
  const n = props.options.length
  let j = -1
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % n
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + n) % n
  else if (e.key === 'Home') j = 0
  else if (e.key === 'End') j = n - 1
  if (j < 0) return
  e.preventDefault()
  emit('update:modelValue', props.options[j].value)
  const parent = (e.currentTarget as HTMLElement).parentElement
  ;(parent?.children[j] as HTMLElement | undefined)?.focus()
}
</script>

<template>
  <div class="seg" :role="mode === 'tabs' ? 'tablist' : 'radiogroup'" :aria-label="label">
    <button
      v-for="(o, i) in options"
      :id="`${idPrefix}-tab-${o.value}`"
      :key="String(o.value)"
      type="button"
      class="seg-btn"
      :role="mode === 'tabs' ? 'tab' : 'radio'"
      :aria-selected="mode === 'tabs' ? o.value === modelValue : undefined"
      :aria-checked="mode === 'radio' ? o.value === modelValue : undefined"
      :aria-controls="mode === 'tabs' ? `${idPrefix}-panel-${o.value}` : undefined"
      :tabindex="o.value === modelValue ? 0 : -1"
      @click="emit('update:modelValue', o.value)"
      @keydown="onKey($event, i)"
    >
      <Icon v-if="o.icon" :name="o.icon" :size="20" />
      <span>{{ o.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.seg {
  display: flex;
  padding: 3px;
  border-radius: 12px;
  background: var(--tp-grey-100);
  gap: 2px;
}
.seg-btn {
  flex: 1 1 0;
  min-width: 0;
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 10px;
  font-weight: 600;
  color: var(--tp-grey-700);
  padding: 0 6px;
}
.seg-btn[aria-selected='true'],
.seg-btn[aria-checked='true'] {
  background: var(--c-surface);
  color: var(--tp-primary-700);
  box-shadow: 0 1px 3px rgba(23, 27, 29, 0.16);
}
@media (max-width: 400px) {
  .seg-btn .icon {
    display: none;
  }
}
</style>
