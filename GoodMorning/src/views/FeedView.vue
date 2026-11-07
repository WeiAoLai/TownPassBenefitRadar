<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../api'
import { friendlyMessage } from '../api/errors'
import type { Artwork } from '../api/types'
import ArtworkCard from '../components/ArtworkCard.vue'
import Icon from '../components/Icon.vue'
import { announce } from '../composables/toast'

const items = ref<Artwork[]>([])
const page = ref(0)
const totalPages = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)
let refreshedForExpiry = false

async function load(reset = false) {
  if (loading.value) return
  loading.value = true
  announce(reset || !items.value.length ? '載入中' : '載入更多作品中')
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
  <div class="page wide">
    <div class="head">
      <h2 class="section-title">大家的作品</h2>
      <RouterLink to="/create" class="btn primary"><Icon name="brush" :size="20" /> 做一張</RouterLink>
    </div>

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
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.head .section-title {
  padding: 0 4px;
}
/* 自適應：手機單欄，寬度夠就自動多欄 */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 160px), 1fr));
  gap: 10px;
}
.ph {
  aspect-ratio: 1;
}
.more {
  margin-top: 16px;
}
</style>
