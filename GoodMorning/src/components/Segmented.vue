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
/*
 * Figma Tab（3:5036）
 * tabs  → Tab primary：白底，選取為 Primary/500 Semibold 字＋底線，未選 Grey/700 Regular
 * radio → Tab secondary：白框 Grey/200，選取為 Primary/50 底＋Primary/500 下框
 */
.seg {
  display: flex;
  gap: 0;
}
.seg-btn {
  flex: 1 1 0;
  min-width: 0;
  min-height: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 6px;
  font-size: var(--tp-font-h3);
  line-height: var(--tp-lh-h3);
  font-weight: 600;
  color: var(--tp-grey-800);
  position: relative;
}
/* 選取中：primary-700 粗體＋ 4px 底線（原主色 2.39:1） */
.seg[role='tablist'] .seg-btn[aria-selected='true'] {
  color: var(--c-action);
  font-weight: 800;
}
.seg[role='tablist'] .seg-btn[aria-selected='true']::after {
  content: '';
  position: absolute;
  left: 12%;
  right: 12%;
  bottom: 0;
  height: 4px;
  border-radius: 2px;
  background: var(--c-action);
}
.seg[role='radiogroup'] {
  border-bottom: 2px solid var(--tp-grey-400);
}
.seg[role='radiogroup'] .seg-btn {
  min-height: 52px;
  background: var(--c-surface);
  border: 2px solid var(--tp-grey-400);
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
}
.seg[role='radiogroup'] .seg-btn + .seg-btn {
  margin-left: -2px;
}
.seg[role='radiogroup'] .seg-btn[aria-checked='true'] {
  background: var(--tp-primary-50);
  color: var(--tp-primary-800);
  font-weight: 800;
  box-shadow: inset 0 -4px 0 var(--c-action);
}
@media (max-width: 400px) {
  .seg-btn .icon {
    display: none;
  }
}
</style>
