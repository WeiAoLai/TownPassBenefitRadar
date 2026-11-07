<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import Icon from './Icon.vue'
import { inTownPass } from '../composables/bridge'

defineProps<{ title: string }>()
/** 在台北通裡由 App 的 AppBar 顯示標題與返回，網頁標題列只保留給輔助科技 */
const hosted = inTownPass()
const route = useRoute()
const router = useRouter()

function back() {
  if (window.history.length > 1) router.back()
  else router.push('/')
}
</script>

<template>
  <header v-if="!hosted" class="topbar">
    <button v-if="route.meta.back" class="icon-btn" type="button" aria-label="返回上一頁" @click="back">
      <Icon name="chevron-left" :size="24" />
    </button>
    <span v-else class="spacer" aria-hidden="true" />
    <h1 class="title" tabindex="-1">
      <span class="logo" aria-hidden="true">✿</span>
      {{ title }}
    </h1>
    <span class="spacer"><slot name="end" /></span>
  </header>
  <h1 v-else class="visually-hidden" tabindex="-1">{{ title }}</h1>
</template>

<style scoped>
/* Figma Top navigation（3:5074）：白底 56 高、左側 56 × 56 返回鈕、標題置中 H3 Semibold Grey/700 */
.topbar {
  flex: none;
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: calc(var(--topnav-h) + env(safe-area-inset-top));
  padding-top: env(safe-area-inset-top);
  background: var(--c-surface);
  color: var(--tp-grey-950);
  border-bottom: 1px solid var(--c-line);
}
.title {
  position: absolute;
  left: 56px;
  right: 56px;
  bottom: 0;
  height: var(--topnav-h);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  line-height: 1.75rem;
  font-weight: 700;
  color: var(--tp-grey-800);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.logo {
  display: none;
}
.spacer,
.icon-btn {
  position: relative;
  width: 56px;
  height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.icon-btn {
  color: inherit;
}
.icon-btn:active {
  background: var(--tp-grey-50);
}
</style>
