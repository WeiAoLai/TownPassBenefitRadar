<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../api'
import { friendlyMessage } from '../api/errors'
import type { LeaderboardEntry } from '../api/types'
import ArtworkCard from '../components/ArtworkCard.vue'
import Icon from '../components/Icon.vue'
import { announce } from '../composables/toast'

const rows = ref<LeaderboardEntry[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
let refreshedForExpiry = false

async function load() {
  loading.value = true
  announce('載入中')
  error.value = null
  try {
    rows.value = await api.getLeaderboard()
  } catch (e) {
    error.value = friendlyMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

/** presigned URL 15 分鐘到期：圖片載入失敗時重抓一次排行榜 */
function onImageError() {
  if (refreshedForExpiry) return
  refreshedForExpiry = true
  load()
}
</script>

<template>
  <div class="page wide">
    <p class="rule small">
      <Icon name="trophy" :size="20" />
      <span>分數＝愛心數和下載數取比較高的那一個；同分同名次。</span>
    </p>
    <button class="btn text refresh" type="button" :disabled="loading" @click="load">
      <Icon name="refresh" :size="20" /> {{ loading ? '更新中…' : '更新排行' }}
    </button>

    <!-- 作品牆的放大版：手機單欄大圖，寬螢幕自動多欄 -->
    <div v-if="loading && !rows.length" class="board" aria-busy="true">
      <div v-for="i in 2" :key="i" class="card ph skeleton" />
    </div>
    <div v-else-if="error" class="empty" role="alert">
      <p>{{ error }}</p>
      <button class="btn primary" type="button" @click="load"><Icon name="refresh" /> 再試一次</button>
    </div>
    <p v-else-if="!rows.length" class="empty">還沒有作品上榜</p>
    <ol v-else class="board">
      <li v-for="r in rows" :key="r.artwork.id">
        <ArtworkCard :artwork="r.artwork" :rank="r.rank" :score="r.score" large @image-error="onImageError" />
      </li>
    </ol>
  </div>
</template>

<style scoped>
.rule {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--radius-m);
  background: var(--c-accent-soft);
  color: var(--tp-secondary-800);
}
.refresh {
  margin: 6px 0 4px auto;
  display: flex;
}
.board {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  /* 手機（內容寬約 380px）一欄；寬度夠才分兩欄、三欄 */
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 16px;
}
.ph {
  aspect-ratio: 1;
}
</style>
