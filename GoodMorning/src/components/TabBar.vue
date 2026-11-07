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
  <nav class="tabbar" aria-label="主要功能">
    <RouterLink
      v-for="t in tabs"
      :key="t.key"
      :to="t.to"
      class="tab"
      :class="{ active: route.meta.tab === t.key, create: t.key === 'create' }"
      :aria-current="route.meta.tab === t.key ? 'page' : undefined"
    >
      <span class="ico"><Icon :name="t.icon" :size="t.key === 'create' ? 26 : 26" /></span>
      <span class="label">{{ t.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.tabbar {
  flex: none;
  position: relative;
  z-index: 30;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  min-height: calc(var(--tabbar-h) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: rgba(255, 255, 255, 0.97);
  border-top: 1px solid var(--c-line);
}
.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 56px;
  color: var(--tp-grey-600);
  text-decoration: none;
  font-size: 0.8rem;
  line-height: 1.1;
}
.tab.active {
  color: var(--tp-primary-600);
  font-weight: 600;
}
.tab.create .ico {
  width: 44px;
  height: 32px;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.tab.create.active .ico {
  background: var(--tp-primary-100);
}
</style>
