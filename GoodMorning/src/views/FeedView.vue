<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../api'
import { friendlyMessage } from '../api/errors'
import type { Artwork } from '../api/types'
import ArtworkCard from '../components/ArtworkCard.vue'
import Icon from '../components/Icon.vue'

const items = ref<Artwork[]>([])
const page = ref(0)
const totalPages = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)
let refreshedForExpiry = false

async function load(reset = false) {
  if (loading.value) return
  loading.value = true
  error.value = null
  try {
    const p = reset ? 0 : page.value
    const res = await api.listArtworks(p, 10)
    items.value = reset ? res.content : [...items.value, ...res.content]
    page.value = res.page + 1
    totalPages.value = res.totalPages
  } catch (e) {
    error.value = friendlyMessage(e)
  } finally {
    loading.value = false
  }
}

/** presigned URL 15 分鐘到期：圖片載入失敗時重抓一次清單 */
function onImageError() {
  if (refreshedForExpiry) return
  refreshedForExpiry = true
  load(true)
}

onMounted(() => load(true))
</script>

<template>
  <div class="page">
    <RouterLink to="/create" class="hero card">
      <div class="hero-text">
        <p class="hero-title">今天也來一張早安圖</p>
        <p class="small muted">選台北景點、挑一則市政好消息，做好就能分享給親友</p>
      </div>
      <span class="hero-cta"><Icon name="brush" /> 開始製作</span>
    </RouterLink>

    <h2 class="section-title">大家的作品</h2>

    <div v-if="!items.length && loading" class="grid" aria-busy="true">
      <div v-for="i in 4" :key="i" class="card ph skeleton" />
    </div>
    <div v-else-if="error && !items.length" class="empty" role="alert">
      <p>{{ error }}</p>
      <button class="btn primary" type="button" @click="load(true)"><Icon name="refresh" /> 重新整理</button>
    </div>
    <p v-else-if="!items.length" class="empty">還沒有人分享作品，來當第一個吧！</p>
    <template v-else>
      <div class="grid">
        <ArtworkCard v-for="a in items" :key="a.id" :artwork="a" @image-error="onImageError" />
      </div>
      <p v-if="error" class="empty small" role="alert">{{ error }}</p>
      <button v-if="page < totalPages" class="btn block more" type="button" :disabled="loading" @click="load()">
        {{ loading ? '載入中…' : '看更多作品' }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  text-decoration: none;
  color: var(--c-text);
  background: linear-gradient(135deg, var(--tp-primary-50), var(--tp-secondary-50));
  border: 1px solid var(--tp-primary-100);
}
.hero-title {
  font-size: var(--tp-font-h2);
  line-height: var(--tp-lh-h2);
  font-weight: 600;
  margin-bottom: 4px;
}
.hero-cta {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 48px;
  padding: 0 20px;
  border-radius: 999px;
  background: var(--c-brand);
  color: #fff;
  font-weight: 600;
}
.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}
@media (min-width: 520px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}
.ph {
  aspect-ratio: 1;
}
.more {
  margin-top: 16px;
}
</style>
