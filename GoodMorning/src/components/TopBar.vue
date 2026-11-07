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

function close() {
  window.close()
}
</script>

<template>
  <header v-if="!hosted" class="topbar">
    <button v-if="route.meta.back" class="icon-btn" type="button" aria-label="返回上一頁" @click="back">
      <Icon name="chevron-left" :size="24" />
    </button>
    <span v-else class="spacer" aria-hidden="true" />
    <h1 class="title" tabindex="-1">
      {{ title }}
    </h1>
    <button class="icon-btn close-btn" type="button" aria-label="關閉" @click="close">
      <Icon name="close" :size="24" />
    </button>
  </header>
  <h1 v-else class="visually-hidden" tabindex="-1">{{ title }}</h1>
</template>

<style scoped>
/* 參考 TownPass 服務頁：品牌色標題列、置中白字、右側關閉；操作區維持 56 × 56。 */
.topbar {
  flex: none;
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: calc(var(--topnav-h) + env(safe-area-inset-top));
  padding-top: env(safe-area-inset-top);
  background: var(--c-brand);
  color: var(--c-on-brand);
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
  font-size: var(--tp-font-h3);
  line-height: var(--tp-lh-h3);
  font-weight: 600;
  color: var(--c-on-brand);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  background: rgb(255 255 255 / 16%);
}
.close-btn {
  margin-left: auto;
}
</style>
