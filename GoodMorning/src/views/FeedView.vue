<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from '../api'
import { friendlyMessage } from '../api/errors'
import type { Artwork, LeaderboardEntry } from '../api/types'
import ArtworkCard from '../components/ArtworkCard.vue'
import Icon from '../components/Icon.vue'
import Segmented from '../components/Segmented.vue'
import { motionOn, setMotion } from '../composables/motion'
import { announce } from '../composables/toast'

type FeedMode = 'ranking' | 'latest'

const mode = ref<FeedMode>('ranking')
const modes: { value: FeedMode; label: string }[] = [
  { value: 'ranking', label: '排行榜' },
  { value: 'latest', label: '最新' },
]

const rankingRows = ref<LeaderboardEntry[]>([])
const topTenRows = computed(() => rankingRows.value.slice(0, 10))
const latestItems = ref<Artwork[]>([])
const latestPage = ref(0)
const latestTotalPages = ref(0)
const loading = reactive<Record<FeedMode, boolean>>({ ranking: false, latest: false })
const loaded = reactive<Record<FeedMode, boolean>>({ ranking: false, latest: false })
const errors = reactive<Record<FeedMode, string | null>>({ ranking: null, latest: null })
const refreshedForExpiry = reactive<Record<FeedMode, boolean>>({ ranking: false, latest: false })

async function load(target: FeedMode, force = false, append = false) {
  if (loading[target] || (loaded[target] && !force && !append)) return
  loading[target] = true
  errors[target] = null
  announce(target === 'ranking' ? '正在載入排行榜' : append ? '正在載入更多作品' : '正在載入最新作品')
  try {
    if (target === 'ranking') rankingRows.value = await api.getLeaderboard()
    else {
      const result = await api.listArtworks(append ? latestPage.value : 0, 10)
      latestItems.value = append ? [...latestItems.value, ...result.content] : result.content
      latestPage.value = result.page + 1
      latestTotalPages.value = result.totalPages
    }
    loaded[target] = true
    announce(target === 'ranking' ? '已顯示排行榜' : append ? '已載入更多作品' : '已顯示最新作品')
  } catch (e) {
    errors[target] = friendlyMessage(e)
  } finally {
    loading[target] = false
  }
}

function selectMode(next: FeedMode) {
  mode.value = next
  if (loaded[next]) announce(next === 'ranking' ? '已顯示排行榜' : '已顯示最新作品')
  else void load(next)
}

/** presigned URL 15 分鐘到期：圖片載入失敗時重抓一次清單 */
function onImageError(target: FeedMode) {
  if (refreshedForExpiry[target]) return
  refreshedForExpiry[target] = true
  void load(target, true)
}

/**
 * 暫停／播放動畫（WCAG 2.2.2：自動播放超過 5 秒的動態要讓使用者能暫停）。
 * 排行榜前三名的吊旗會持續飄動、閃光，所以在頁面上放一顆按鈕；它和「我的 › 設定 › 動畫效果」是同一個開關，
 * 暫停後整個 App 的動畫（含慶祝畫面）都停，記在這支手機上。
 */
function toggleMotion() {
  setMotion(!motionOn.value)
  announce(motionOn.value ? '已播放動畫' : '已暫停動畫')
}

onMounted(() => load('ranking'))
</script>

<template>
  <div class="page wide">
    <Segmented
      class="view-tabs"
      :model-value="mode"
      :options="modes"
      label="作品排列方式"
      mode="tabs"
      id-prefix="feed-view"
      @update:model-value="selectMode"
    />

    <section
      id="feed-view-panel-ranking"
      role="tabpanel"
      aria-labelledby="feed-view-tab-ranking"
      :hidden="mode !== 'ranking'"
    >
      <div v-if="rankingRows.length" class="board-tools">
        <button class="btn text motion-btn" type="button" @click="toggleMotion">
          <Icon :name="motionOn ? 'pause' : 'play'" :size="20" /> {{ motionOn ? '暫停動畫' : '播放動畫' }}
        </button>
      </div>
      <div v-if="loading.ranking && !rankingRows.length" class="board" aria-busy="true">
        <div v-for="i in 3" :key="i" class="card ph skeleton" />
      </div>
      <div v-else-if="errors.ranking && !rankingRows.length" class="empty" role="alert">
        <p>{{ errors.ranking }}</p>
        <button class="btn primary" type="button" @click="load('ranking', true)"><Icon name="refresh" /> 重新整理</button>
      </div>
      <p v-else-if="!rankingRows.length" class="empty">還沒有作品上榜</p>
      <ol v-else class="board" aria-label="排行榜前十名">
        <li v-for="(r, index) in topTenRows" :key="r.artwork.id">
          <ArtworkCard
            :artwork="r.artwork"
            :rank="index < 3 ? r.rank : undefined"
            :score="r.score"
            large
            @image-error="onImageError('ranking')"
          />
        </li>
      </ol>
      <p v-if="errors.ranking && rankingRows.length" class="empty small" role="alert">{{ errors.ranking }}</p>
    </section>

    <section
      id="feed-view-panel-latest"
      role="tabpanel"
      aria-labelledby="feed-view-tab-latest"
      :hidden="mode !== 'latest'"
    >
      <div v-if="loading.latest && !latestItems.length" class="grid" aria-busy="true">
        <div v-for="i in 4" :key="i" class="card ph skeleton" />
      </div>
      <div v-else-if="errors.latest && !latestItems.length" class="empty" role="alert">
        <p>{{ errors.latest }}</p>
        <button class="btn primary" type="button" @click="load('latest', true)"><Icon name="refresh" /> 重新整理</button>
      </div>
      <p v-else-if="!latestItems.length" class="empty">還沒有人分享作品，來當第一個吧！</p>
      <div v-else class="grid">
        <ArtworkCard v-for="a in latestItems" :key="a.id" :artwork="a" @image-error="onImageError('latest')" />
      </div>
      <p v-if="errors.latest && latestItems.length" class="empty small" role="alert">{{ errors.latest }}</p>
      <button
        v-if="latestPage < latestTotalPages"
        class="btn block more"
        type="button"
        :disabled="loading.latest"
        @click="load('latest', false, true)"
      >
        {{ loading.latest ? '載入中…' : '看更多作品' }}
      </button>
    </section>
  </div>
</template>

<style scoped>
.view-tabs {
  margin-bottom: 12px;
}
.view-tabs :deep(.seg-btn) {
  min-height: 48px;
}
.board-tools {
  display: flex;
  justify-content: flex-end;
  margin: -4px 0 4px;
}
/* 觸控目標至少 48px */
.motion-btn {
  min-height: 48px;
}
.board {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 16px;
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
