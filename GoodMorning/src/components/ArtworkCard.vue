<script setup lang="ts">
import type { Artwork } from '../api/types'
import BadgeChip from './BadgeChip.vue'
import Icon from './Icon.vue'
import { toggleLike } from '../composables/artworkActions'

/** large：單欄大卡片（排行榜用），名字與名次放大；預設是作品牆的兩欄小卡片 */
const props = defineProps<{ artwork: Artwork; rank?: number; score?: number; large?: boolean }>()
const emit = defineEmits<{ imageError: [] }>()
</script>

<template>
  <article class="art card" :class="{ large }" :aria-label="`${props.artwork.owner.displayName} 的作品`">
    <RouterLink :to="`/artworks/${artwork.id}`" class="thumb-link">
      <img
        class="thumb"
        :src="artwork.imageUrl"
        :alt="`長輩圖：${artwork.sloganText.replace(/\n/g, ' ')}`"
        loading="lazy"
        width="1080"
        height="1080"
        @error="emit('imageError')"
      />
      <span v-if="rank" class="rank" :class="`r${Math.min(rank, 4)}`">第 {{ rank }} 名</span>
    </RouterLink>
    <div class="meta">
      <div class="author">
        <span class="name">{{ artwork.owner.displayName }}</span>
        <BadgeChip :badge="artwork.owner.badge" compact />
      </div>
      <div class="acts">
        <button
          type="button"
          class="act like"
          :class="{ on: artwork.likedByMe }"
          :aria-pressed="artwork.likedByMe"
          :aria-label="`愛心，目前 ${artwork.likeCount} 個`"
          :disabled="artwork.ownedByMe"
          @click="toggleLike(artwork)"
        >
          <Icon name="heart" :filled="artwork.likedByMe" />
          <span aria-hidden="true">{{ artwork.likeCount }}</span>
        </button>
      </div>
    </div>
    <p v-if="score != null" class="score">
      <span><strong>{{ score }}</strong> 分</span>
      <span>愛心 {{ artwork.likeCount }}</span>
      <span>下載 {{ artwork.downloadCount }}</span>
    </p>
  </article>
</template>

<style scoped>
.art {
  overflow: hidden;
}
.thumb-link {
  position: relative;
  display: block;
}
.thumb {
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  object-fit: cover;
  background: var(--tp-grey-100);
}
.rank {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: var(--tp-font-h3);
  font-weight: 800;
  background: rgba(23, 27, 29, 0.8);
  color: #fff;
}
/* 前三名：淺底深字（對比 9–12:1）；原本金／銀／銅底配白字只有 2.15／2.69／3.72 */
.rank.r1 {
  background: var(--tp-secondary-500);
  color: var(--tp-grey-950);
}
.rank.r2 {
  background: var(--tp-grey-200);
  color: var(--tp-grey-950);
}
.rank.r3 {
  background: var(--tp-orange-300);
  color: var(--tp-grey-950);
}
.meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 0 0 10px;
}
.author {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
/* 作品卡兩欄只有約 190px 寬，作者名維持 16px（18px 時四個字的名字會被截成「秀英…」） */
.name {
  font-size: var(--tp-font-body);
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mine {
  font-size: var(--tp-font-body);
  padding: 0 8px;
  border-radius: 8px;
  background: var(--c-brand-soft);
  color: var(--c-brand-strong);
}
.acts {
  display: flex;
  flex: none;
}
.act {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 48px;
  min-height: 48px;
  padding: 0 10px;
  border-radius: 8px;
  color: var(--tp-grey-700);
  font-weight: 600;
}
.act:active {
  background: var(--tp-grey-50);
}
.act.like.on {
  color: var(--c-like);
}
.act:disabled {
  opacity: 0.5;
}
.score {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 18px;
  padding: 0 14px 14px;
  color: var(--tp-grey-800);
  font-weight: 600;
}
.score strong {
  font-size: 1.75rem;
  line-height: 2rem;
  color: var(--tp-primary-700);
}

/* 排行榜大卡片：名字 20px、名次標籤更大 */
.art.large .name {
  font-size: 1.25rem;
  font-weight: 800;
}
.art.large .meta {
  padding-left: 14px;
}
.art.large .rank {
  top: 12px;
  left: 12px;
  padding: 8px 18px;
  font-size: 1.375rem;
}
</style>
