<script setup lang="ts">
import { useRoute } from 'vue-router'
import Icon from './Icon.vue'

const route = useRoute()
const tabs = [
  { key: 'feed', to: '/', label: '作品牆', icon: 'home' },
  { key: 'create', to: '/create', label: '製作', icon: 'brush' },
  { key: 'rank', to: '/leaderboard', label: '排行榜', icon: 'trophy' },
  { key: 'me', to: '/me', label: '我的', icon: 'user' },
] as const
</script>

<template>
  <!-- Figma Foot tab bar（3:5129）：白底、上框 Grey/100、圖示 24、文字 Body 14 -->
  <nav class="tabbar" aria-label="主要功能">
    <RouterLink
      v-for="t in tabs"
      :key="t.key"
      :to="t.to"
      class="tab"
      :class="{ active: route.meta.tab === t.key }"
      :aria-current="route.meta.tab === t.key ? 'page' : undefined"
    >
      <Icon :name="t.icon" :size="24" />
      <span class="label">{{ t.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.tabbar {
  flex: none;
  position: relative;
  z-index: 30;
  display: flex;
  gap: 8px;
  padding: 4px 12px env(safe-area-inset-bottom);
  background: var(--c-surface);
  border-top: 1px solid var(--c-line);
}
.tab {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  color: var(--tp-grey-950);
  text-decoration: none;
  font-size: var(--tp-font-body);
  line-height: var(--tp-lh-body);
}
.tab.active {
  color: var(--tp-primary-500);
}
.label {
  white-space: nowrap;
}
</style>
