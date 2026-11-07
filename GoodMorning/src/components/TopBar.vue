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
      <Icon name="chevron-left" :size="28" />
    </button>
    <span v-else class="spacer" aria-hidden="true" />
    <h1 class="title">
      <span class="logo" aria-hidden="true">✿</span>
      {{ title }}
    </h1>
    <span class="spacer"><slot name="end" /></span>
  </header>
  <h1 v-else class="visually-hidden">{{ title }}</h1>
</template>

<style scoped>
.topbar {
  flex: none;
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: calc(56px + env(safe-area-inset-top));
  padding: env(safe-area-inset-top) 4px 0;
  background: linear-gradient(90deg, var(--tp-primary-400), var(--tp-primary-500) 55%, #5aa1c5);
  color: var(--c-on-brand);
}
.title {
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.logo {
  font-size: 1.1rem;
  opacity: 0.9;
}
.spacer,
.icon-btn {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.icon-btn {
  color: inherit;
  border-radius: 50%;
}
.icon-btn:active {
  background: rgba(255, 255, 255, 0.18);
}
</style>
