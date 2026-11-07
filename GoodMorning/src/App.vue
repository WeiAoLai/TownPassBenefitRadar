<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { apiMode } from './api'
import TopBar from './components/TopBar.vue'
import TabBar from './components/TabBar.vue'
import ToastHost from './components/ToastHost.vue'
import DownloadSheet from './components/DownloadSheet.vue'

const route = useRoute()
const title = computed(() => route.meta.title ?? '早安政策圖')
const main = ref<HTMLElement | null>(null)
// 內容區自己捲動，換頁時回到頂端
watch(
  () => route.fullPath,
  () => main.value?.scrollTo?.({ top: 0 }),
)
</script>

<template>
  <TopBar :title="title" />
  <p v-if="apiMode === 'mock'" class="mock-banner small">示範資料：內容僅供測試</p>
  <main ref="main">
    <RouterView />
  </main>
  <TabBar />
  <DownloadSheet />
  <ToastHost />
</template>

<style>
.mock-banner {
  flex: none;
  margin: 0;
  padding: 4px 16px;
  text-align: center;
  background: var(--c-accent-soft);
  color: var(--tp-secondary-800);
}
</style>
