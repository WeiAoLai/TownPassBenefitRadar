<script setup lang="ts">
import type { Artwork } from '../api/types'
import BadgeChip from './BadgeChip.vue'
import Icon from './Icon.vue'
import { startDownload, toggleLike } from '../composables/artworkActions'

const props = defineProps<{ artwork: Artwork; rank?: number; score?: number }>()
const emit = defineEmits<{ imageError: [] }>()
</script>

<template>
  <article class="art card" :aria-label="`${props.artwork.owner.displayName} 的作品`">
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
        <span v-if="artwork.ownedByMe" class="mine">我的</span>
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
        <button
          type="button"
          class="act"
          :aria-label="`下載，已下載 ${artwork.downloadCount} 次`"
          @click="startDownload(artwork)"
        >
          <Icon name="download" />
          <span aria-hidden="true">{{ artwork.downloadCount }}</span>
        </button>
      </div>
    </div>
    <p v-if="score != null" class="score small">排行分數 {{ score }}（愛心與下載取高者）</p>
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
  padding: 4px 12px;
  border-radius: 999px;
  font-weight: 700;
  background: rgba(23, 27, 29, 0.75);
  color: #fff;
}
.rank.r1 {
  background: #e7a43c;
}
.rank.r2 {
  background: #91a0a8;
}
.rank.r3 {
  background: #ad7b2b;
}
.meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 4px 4px 14px;
}
.author {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mine {
  font-size: var(--tp-font-body);
  padding: 0 8px;
  border-radius: 999px;
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
  border-radius: 24px;
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
  padding: 0 14px 12px;
  color: var(--c-text-2);
}
</style>
