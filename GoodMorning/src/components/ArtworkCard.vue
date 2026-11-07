<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Artwork } from '../api/types'
import BadgeChip from './BadgeChip.vue'
import Icon from './Icon.vue'
import { toggleLike } from '../composables/artworkActions'

/** large：單欄大卡片（排行榜用），名字與名次放大；預設是作品牆的兩欄小卡片 */
const props = defineProps<{ artwork: Artwork; rank?: number; score?: number; large?: boolean }>()
const emit = defineEmits<{ imageError: [] }>()

const imageReady = ref(false)
const imageFailed = ref(false)

watch(
  () => props.artwork.imageUrl,
  () => {
    imageReady.value = false
    imageFailed.value = false
  },
)

async function onImageLoad(event: Event) {
  const image = event.currentTarget as HTMLImageElement
  try {
    await image.decode()
  } catch {
    // 部分瀏覽器不支援 decode，load 完成後仍可安全顯示。
  }
  if (image.getAttribute('src') === props.artwork.imageUrl) {
    imageReady.value = true
  }
}

function onImageError() {
  imageReady.value = false
  imageFailed.value = true
  emit('imageError')
}

</script>

<template>
  <article class="art card" :class="{ large }" :aria-label="`${props.artwork.owner.displayName} 的作品`">
    <RouterLink :to="`/artworks/${artwork.id}`" class="thumb-link" :aria-busy="!imageReady && !imageFailed">
      <span v-if="!imageReady && !imageFailed" class="image-placeholder skeleton" aria-hidden="true" />
      <span v-else-if="imageFailed" class="image-error" role="img" aria-label="圖片載入失敗">圖片載入失敗</span>
      <img
        class="thumb"
        :class="{ ready: imageReady }"
        :src="artwork.imageUrl"
        :alt="`長輩圖：${artwork.sloganText.replace(/\n/g, ' ')}`"
        loading="lazy"
        decoding="async"
        width="1080"
        height="1080"
        @load="onImageLoad"
        @error="onImageError"
      />
      <span v-if="rank && rank <= 3" class="rank" :class="`r${rank}`">第 {{ rank }} 名</span>
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
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--tp-grey-100);
}
.thumb {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 160ms ease-out;
}
.thumb.ready {
  opacity: 1;
}
.image-placeholder,
.image-error {
  position: absolute;
  inset: 0;
}
.image-error {
  display: grid;
  place-items: center;
  padding: 16px;
  color: var(--tp-grey-700);
  font-size: var(--tp-font-body);
  text-align: center;
}
.rank {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: var(--tp-font-h3);
  font-weight: 600;
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
/* 窄螢幕、大字時作者名與徽章可以換行，名字不會被截成「秀英…」（台北通 DT：大字不遺失內容） */
.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0 8px;
  padding: 0 0 0 10px;
}
.author {
  display: flex;
  flex: 1 1 5rem;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 6px;
  min-width: 0;
  padding: 6px 0;
}
.name {
  font-size: var(--tp-font-body);
  font-weight: 600;
  overflow-wrap: anywhere;
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
  min-height: 38px;
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

/* 排行榜大卡片：名字 H3、名次標籤用 H2 */
.art.large .name {
  font-size: var(--tp-font-h3);
  line-height: var(--tp-lh-h3);
  font-weight: 600;
}
.art.large .meta {
  padding-left: 14px;
}
.art.large .rank {
  top: 12px;
  left: 12px;
  padding: 8px 18px;
  font-size: var(--tp-font-h2);
  line-height: var(--tp-lh-h2);
}
</style>
