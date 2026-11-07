<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../api'
import { friendlyMessage } from '../api/errors'
import type { LeaderboardEntry } from '../api/types'
import BadgeChip from '../components/BadgeChip.vue'
import Icon from '../components/Icon.vue'

const rows = ref<LeaderboardEntry[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
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

const medal = (r: number) => (r === 1 ? 'gold' : r === 2 ? 'silver' : r === 3 ? 'bronze' : '')
</script>

<template>
  <div class="page">
    <p class="rule small">
      <Icon name="trophy" :size="20" />
      <span>分數＝愛心數和下載數取比較高的那一個；同分同名次。</span>
    </p>
    <button class="btn text refresh" type="button" :disabled="loading" @click="load">
      <Icon name="refresh" :size="20" /> {{ loading ? '更新中…' : '更新排行' }}
    </button>

    <div v-if="loading && !rows.length" class="list" aria-busy="true">
      <div v-for="i in 5" :key="i" class="list-row"><span class="grow skeleton" style="height: 64px" /></div>
    </div>
    <div v-else-if="error" class="empty" role="alert">
      <p>{{ error }}</p>
      <button class="btn primary" type="button" @click="load"><Icon name="refresh" /> 再試一次</button>
    </div>
    <p v-else-if="!rows.length" class="empty">還沒有作品上榜</p>
    <ol v-else class="list board">
      <li v-for="r in rows" :key="r.artwork.id">
        <RouterLink
          :to="`/artworks/${r.artwork.id}`"
          class="list-row entry"
          :aria-label="`第 ${r.rank} 名，${r.artwork.owner.displayName} 的作品，${r.score} 分，愛心 ${r.artwork.likeCount}，下載 ${r.artwork.downloadCount}`"
        >
          <span class="rank" :class="medal(r.rank)" aria-hidden="true">{{ r.rank }}</span>
          <img :src="r.artwork.imageUrl" alt="" class="thumb" loading="lazy" />
          <span class="grow info" aria-hidden="true">
            <span class="who">
              <span class="name">{{ r.artwork.owner.displayName }}</span>
              <BadgeChip :badge="r.artwork.owner.badge" compact />
            </span>
            <span class="small muted nums">
              <span><Icon name="heart" :size="14" :filled="r.artwork.likedByMe" /> {{ r.artwork.likeCount }}</span>
              <span><Icon name="download" :size="14" /> {{ r.artwork.downloadCount }}</span>
            </span>
          </span>
          <span class="score" aria-hidden="true">
            <strong>{{ r.score }}</strong>
            <span class="small muted">分</span>
          </span>
          <Icon name="chevron-right" :size="20" class="chev" />
        </RouterLink>
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
}
.entry {
  gap: 10px;
  padding: 8px 8px 8px 12px;
}
.board li + li .entry::before {
  content: '';
  position: absolute;
  top: 0;
  left: 16px;
  right: 0;
  border-top: 1px solid var(--c-line);
}
.rank {
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  background: var(--tp-grey-100);
  color: var(--tp-grey-700);
}
.rank.gold {
  background: #e7a43c;
  color: #fff;
}
.rank.silver {
  background: #91a0a8;
  color: #fff;
}
.rank.bronze {
  background: #ad7b2b;
  color: #fff;
}
.thumb-link {
  flex: none;
}
.thumb {
  width: 64px;
  height: 64px;
  border-radius: 10px;
  object-fit: cover;
  background: var(--tp-grey-100);
}
.info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 90px;
}
.who {
  display: flex;
  align-items: center;
  gap: 4px;
}
.name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nums {
  display: flex;
  gap: 10px;
}
.score {
  display: flex;
  align-items: baseline;
  gap: 2px;
}
.score strong {
  font-size: 1.3rem;
  color: var(--tp-primary-700);
}
.entry {
  text-decoration: none;
  color: inherit;
}
.nums span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.chev {
  color: var(--tp-grey-300);
}
</style>
