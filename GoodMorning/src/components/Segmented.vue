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
    /** 只顯示圖示；文字仍留給讀報軟體 */
    iconOnly?: boolean
  }>(),
  { mode: 'radio', idPrefix: 'seg', iconOnly: false },
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
  <div class="seg" :class="{ 'icon-only': iconOnly }" :role="mode === 'tabs' ? 'tablist' : 'radiogroup'" :aria-label="label">
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
      <Icon v-if="o.icon" :name="o.icon" :size="iconOnly ? 26 : 20" />
      <span :class="{ 'visually-hidden': iconOnly && o.icon }">{{ o.label }}</span>
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
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 6px;
  font-size: var(--tp-font-h3);
  line-height: var(--tp-lh-h3);
  /* Figma Tab：未選 Regular、選取 Semibold */
  font-weight: 400;
  color: var(--tp-grey-800);
  position: relative;
}
/* 選取中：主色 primary-500 Semibold＋ 4px 底線 */
.seg[role='tablist'] .seg-btn[aria-selected='true'] {
  color: var(--c-action);
  font-weight: 600;
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
  border-bottom: 1px solid var(--tp-grey-400);
}
.seg[role='radiogroup'] .seg-btn {
  min-height: 48px;
  background: var(--c-surface);
  border: 1px solid var(--tp-grey-400);
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
}
.seg[role='radiogroup'] .seg-btn + .seg-btn {
  margin-left: -1px;
}
.seg[role='radiogroup'] .seg-btn[aria-checked='true'] {
  background: var(--tp-primary-50);
  color: var(--c-action);
  font-weight: 600;
  box-shadow: inset 0 -4px 0 var(--c-action);
}
/*
 * 圖示按鈕組（icon-only）：一般按鈕外觀（四邊框、圓角 8），整組相連；
 * 選取中為主色 primary-500 實心底＋白色圖示，不只靠顏色（還有實心底與加粗外框）
 */
.seg.icon-only[role='radiogroup'] {
  border-bottom: 0;
}
.seg.icon-only[role='radiogroup'] .seg-btn {
  min-height: 48px;
  background: var(--c-surface);
  color: var(--tp-grey-800);
  border: 1px solid var(--tp-grey-400);
  border-radius: 0;
  box-shadow: none;
}
.seg.icon-only[role='radiogroup'] .seg-btn:first-child {
  border-radius: 8px 0 0 8px;
}
.seg.icon-only[role='radiogroup'] .seg-btn:last-child {
  border-radius: 0 8px 8px 0;
}
.seg.icon-only[role='radiogroup'] .seg-btn[aria-checked='true'] {
  position: relative;
  z-index: 1;
  background: var(--c-action);
  border-color: var(--c-action);
  color: #fff;
}
.seg.icon-only[role='radiogroup'] .seg-btn:active {
  background: var(--tp-primary-50);
}
.seg.icon-only[role='radiogroup'] .seg-btn[aria-checked='true']:active {
  background: var(--c-action-press);
}
/* 窄螢幕時有文字的按鈕只留文字；只有圖示的按鈕（icon-only）不能藏 */
@media (max-width: 400px) {
  .seg:not(.icon-only) .seg-btn .icon {
    display: none;
  }
}
</style>
