<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api'
import { friendlyMessage } from '../api/errors'
import type { Artwork } from '../api/types'
import BadgeChip from '../components/BadgeChip.vue'
import Icon from '../components/Icon.vue'
import { startDownload, toggleLike } from '../composables/artworkActions'

const route = useRoute()
const art = ref<Artwork | null>(null)
const error = ref<string | null>(null)
const loading = ref(true)

async function load() {
  loading.value = true
  error.value = null
  try {
    art.value = await api.getArtwork(Number(route.params.id))
    document.title = `${art.value.owner.displayName} 的作品`
  } catch (e) {
    error.value = friendlyMessage(e)
  } finally {
    loading.value = false
  }
}

const when = (iso: string) =>
  new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  )

/** presigned URL 到期時重抓一次 */
let retried = false
function onImgError() {
  if (retried) return
  retried = true
  load()
}

onMounted(load)
watch(() => route.params.id, load)
</script>

<template>
  <div class="page">
    <div v-if="loading" class="card ph skeleton" aria-busy="true" />
    <div v-else-if="error" class="empty" role="alert">
      <p>{{ error }}</p>
      <button class="btn primary" type="button" @click="load"><Icon name="refresh" /> 再試一次</button>
    </div>
    <article v-else-if="art" class="detail">
      <img class="img card" :src="art.imageUrl" :alt="`長輩圖：${art.sloganText.replace(/\n/g, ' ')}`" @error="onImgError" />

      <div class="list">
        <div class="list-row">
          <span class="avatar" aria-hidden="true">{{ art.owner.displayName.slice(0, 1) }}</span>
          <span class="grow">
            <span class="name">{{ art.owner.displayName }}</span>
            <span class="small muted block">{{ when(art.createdAt) }}</span>
          </span>
          <BadgeChip :badge="art.owner.badge" />
        </div>
        <div class="list-row">
          <span class="grow slogan">{{ art.sloganText }}</span>
        </div>
      </div>

      <div class="stats" aria-label="互動數">
        <div><strong>{{ art.likeCount }}</strong><span class="small muted">愛心</span></div>
        <div><strong>{{ art.downloadCount }}</strong><span class="small muted">下載</span></div>
        <div><strong>{{ Math.max(art.likeCount, art.downloadCount) }}</strong><span class="small muted">排行分數</span></div>
      </div>

      <div class="actions">
        <button
          type="button"
          class="btn large"
          :class="{ liked: art.likedByMe }"
          :aria-pressed="art.likedByMe"
          :disabled="art.ownedByMe"
          @click="toggleLike(art)"
        >
          <Icon name="heart" :filled="art.likedByMe" />
          {{ art.ownedByMe ? '自己的作品' : art.likedByMe ? '已按愛心' : '按愛心' }}
        </button>
        <button type="button" class="btn primary large" @click="startDownload(art)">
          <Icon name="download" /> 下載分享
        </button>
      </div>
      <p class="small muted center">下載的圖片會附上政策 QR Code，親友掃描就能看政策說明</p>
    </article>
  </div>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ph,
.img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}
.avatar {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--tp-primary-100);
  color: var(--tp-primary-700);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}
.name {
  font-weight: 600;
}
span.block {
  display: block;
}
.slogan {
  white-space: pre-line;
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.stats > div {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 4px;
  background: var(--c-surface);
  border-radius: var(--radius-m);
  box-shadow: var(--shadow-1);
}
.stats strong {
  font-size: var(--tp-font-h2);
  line-height: var(--tp-lh-h2);
}
.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.liked {
  color: var(--c-like);
  border-color: var(--c-like);
}
.center {
  text-align: center;
}
</style>
