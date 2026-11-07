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
      <!-- 前三名的吊旗：像書籤從照片上緣垂下來。圖形（直寫三行）給眼睛看、aria-hidden；「第 N 名」整句另放一份給讀報軟體 -->
      <span v-if="rank && rank <= 3" class="pennant-wrap" :class="`r${rank}`">
        <span class="visually-hidden">第 {{ rank }} 名</span>
        <span class="pennant" aria-hidden="true"><small>第</small><strong>{{ rank }}</strong><small>名</small></span>
      </span>
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
/*
 * 名次吊旗（前三名）：金／銀／銅色底、深色字，下緣燕尾缺口，垂在照片左上角；顏色從上緣到下緣一致（只有淺到深的過渡，
 * 上緣不加淺色條，才會和照片邊緣切齊），再有一道光澤從左上往右下流過、整面吊旗輕輕飄動。
 * 色票與對比見 tokens.css --c-rank-*（tests/contrast.test.ts 檢查）。尺寸全部用 em，
 * 基準字級 = 使用者字級（最小 16px、最大 20px）：文字放大時吊旗跟著大，但最多放大到 1.25 倍，免得蓋住太多長輩圖
 * （名次另有一句看不見的「第 N 名」給讀報軟體，不靠視覺大小）。
 */
.pennant-wrap {
  --mid: var(--c-rank-1-mid);
  --deep: var(--c-rank-1-deep);
  --ink: var(--c-rank-1-ink);
  position: absolute;
  /* 往上多伸出 0.25em（被照片邊緣裁掉）：吊旗輕微擺動時，上緣的角不會離開照片邊緣露出縫 */
  top: -0.25em;
  left: 14px;
  font-size: max(16px, min(1rem, 20px));
  /* clip-path 會把自己的陰影也裁掉，所以陰影加在外層 */
  filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.4));
  pointer-events: none;
}
.pennant-wrap.r2 {
  --mid: var(--c-rank-2-mid);
  --deep: var(--c-rank-2-deep);
  --ink: var(--c-rank-2-ink);
}
.pennant-wrap.r3 {
  --mid: var(--c-rank-3-mid);
  --deep: var(--c-rank-3-deep);
  --ink: var(--c-rank-3-ink);
}
.pennant {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 3.75em;
  padding: 0.75em 0 1.375em;
  color: var(--ink);
  font-weight: 600;
  line-height: 1.1;
  background: linear-gradient(180deg, var(--mid), var(--deep));
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 0.8em), 0 100%);
  /* 輕微飄動：以上緣為軸左右擺 ±1.2°、同時微微歪斜，像布掛在那裡被風吹；三面吊旗週期不同，不會整齊劃一 */
  transform-origin: 50% 0;
  animation: pennant-sway 5s ease-in-out infinite;
}
.pennant-wrap.r2 .pennant {
  animation-duration: 5.7s;
  animation-delay: -1.9s;
}
.pennant-wrap.r3 .pennant {
  animation-duration: 6.3s;
  animation-delay: -3.6s;
}
@keyframes pennant-sway {
  0%,
  100% {
    transform: rotate(0deg) skewX(0deg);
  }
  25% {
    transform: rotate(1.2deg) skewX(-1deg);
  }
  75% {
    transform: rotate(-1.2deg) skewX(1deg);
  }
}
/*
 * 光澤流淌：一道柔和的亮帶從左上往右下斜斜流過吊旗，流完停一下再來，三面吊旗錯開時間（用負的延遲，不會同時閃）。
 * 亮帶是 2 倍大的斜向漸層方塊（inset: -50%，中心對齊吊旗），沿對角線平移；位移用 em，跟著吊旗大小。
 * 只用 transform，吊旗的 clip-path 會把亮帶裁成吊旗的形狀。動畫效果關閉（我的 › 設定）或系統設定「減少動態」時，
 * base.css 會把動畫關掉，亮帶停在吊旗外面、看不見。
 */
.pennant::after {
  content: '';
  position: absolute;
  inset: -50%;
  z-index: 0;
  pointer-events: none;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0) 43%, rgba(255, 255, 255, 0.7) 50%, rgba(255, 255, 255, 0) 57%);
  transform: translate(-3.4em, -3.4em);
  animation: pennant-flow 3.6s ease-in-out infinite;
}
.pennant-wrap.r2 .pennant::after {
  animation-delay: -1.2s;
}
.pennant-wrap.r3 .pennant::after {
  animation-delay: -2.4s;
}
@keyframes pennant-flow {
  0% {
    transform: translate(-3.4em, -3.4em);
  }
  60%,
  100% {
    transform: translate(3.4em, 3.4em);
  }
}
/* 文字在光澤上面：亮帶只流過底色，不會把字洗淡（對比不會在動畫途中掉下去） */
.pennant small,
.pennant strong {
  position: relative;
  z-index: 1;
}
.pennant small {
  font-size: 1em;
}
.pennant strong {
  font-size: 2.125em;
  font-weight: 600;
  line-height: 1.05;
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

/* 排行榜大卡片：名字 H3 */
.art.large .name {
  font-size: var(--tp-font-h3);
  line-height: var(--tp-lh-h3);
  font-weight: 600;
}
.art.large .meta {
  padding-left: 14px;
}
</style>
