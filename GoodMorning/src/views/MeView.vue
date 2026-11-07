<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { api, apiMode, demoUser, demoUsers, resetMockData, setDemoUser } from '../api'
import { friendlyMessage } from '../api/errors'
import type { Artwork, Background, CurrentUser } from '../api/types'
import BadgeChip from '../components/BadgeChip.vue'
import BottomSheet from '../components/BottomSheet.vue'
import Icon from '../components/Icon.vue'
import { BADGES, badgeIconDataUrl, nextBadge } from '../config/badges'
import { toast } from '../composables/toast'

const me = ref<CurrentUser | null>(null)
const backgrounds = ref<Background[]>([])
const items = ref<Artwork[]>([])
const page = ref(0)
const totalPages = ref(0)
const loading = ref(true)
const more = ref(false)
const error = ref<string | null>(null)
const pickUser = ref(false)
const showBadges = ref(false)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [u, bgs, arts] = await Promise.all([api.getCurrentUser(), api.listBackgrounds(), api.listMyArtworks(0, 12)])
    me.value = u
    backgrounds.value = bgs
    items.value = arts.content
    page.value = 1
    totalPages.value = arts.totalPages
  } catch (e) {
    error.value = friendlyMessage(e)
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  more.value = true
  try {
    const res = await api.listMyArtworks(page.value, 12)
    items.value = [...items.value, ...res.content]
    page.value = res.page + 1
    totalPages.value = res.totalPages
  } catch (e) {
    toast(friendlyMessage(e), 'error')
  } finally {
    more.value = false
  }
}

const count = computed(() => me.value?.artworkCount ?? 0)
const next = computed(() => nextBadge(count.value))
const progress = computed(() => {
  if (!next.value) return 100
  const prev = BADGES.filter((b) => b.threshold <= count.value).pop()?.threshold ?? 0
  return Math.round(((count.value - prev) / (next.value.threshold - prev)) * 100)
})
const locked = computed(() => backgrounds.value.filter((b) => !b.unlocked))

function choose(u: string) {
  setDemoUser(u)
  pickUser.value = false
}
watch(demoUser, load)

async function reset() {
  await resetMockData()
  toast('示範資料已重設', 'success')
  load()
}

/** presigned URL 到期時重抓一次 */
let retried = false
function onImgError() {
  if (retried) return
  retried = true
  load()
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div v-if="loading && !me" class="card profile skeleton" style="height: 160px" aria-busy="true" />
    <div v-else-if="error" class="empty" role="alert">
      <p>{{ error }}</p>
      <div class="err-acts">
        <button class="btn primary" type="button" @click="load"><Icon name="refresh" /> 再試一次</button>
        <button class="btn" type="button" @click="pickUser = true">切換示範帳號</button>
      </div>
    </div>
    <template v-else-if="me">
      <section class="card profile" aria-labelledby="me-name">
        <div class="who">
          <span class="avatar" aria-hidden="true">{{ me.displayName.slice(0, 1) }}</span>
          <div class="grow">
            <h2 id="me-name" class="name">{{ me.displayName }}</h2>
            <BadgeChip v-if="me.badge" :badge="me.badge" />
            <span v-else class="small muted">儲存第一張作品就能拿到徽章</span>
          </div>
        </div>
        <div class="stat-row">
          <div class="stat">
            <strong>{{ me.artworkCount }}</strong>
            <span class="small muted">累積作品</span>
          </div>
          <div class="stat">
            <strong>{{ me.badge?.level ?? 0 }}</strong>
            <span class="small muted">徽章等級</span>
          </div>
        </div>
        <div v-if="next" class="progress-wrap">
          <div class="progress-label small">
            <span>下一個徽章「{{ next.name }}」</span>
            <span>{{ me.artworkCount }}/{{ next.threshold }} 張</span>
          </div>
          <div
            class="progress"
            role="progressbar"
            :aria-valuenow="progress"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`距離下一個徽章還差 ${next.threshold - me.artworkCount} 張`"
          >
            <span :style="{ width: progress + '%' }" />
          </div>
        </div>
        <p v-else class="small">已經拿到最高等級徽章，太厲害了！</p>
        <button type="button" class="btn text block" @click="showBadges = true">
          <Icon name="medal" :size="20" /> 看全部十種徽章
        </button>
      </section>

      <section v-if="locked.length" aria-labelledby="unlock-title">
        <h2 id="unlock-title" class="section-title">待解鎖背景</h2>
        <div class="list">
          <div v-for="b in locked" :key="b.id" class="list-row">
            <img :src="b.imageUrl" alt="" class="bg-thumb" />
            <span class="grow">
              <span class="row-title">{{ b.name }}</span>
              <span class="small muted block">再儲存 {{ b.unlockThreshold - me.artworkCount }} 張就解鎖</span>
            </span>
            <Icon name="lock" />
          </div>
        </div>
      </section>

      <section aria-labelledby="mine-title">
        <h2 id="mine-title" class="section-title">我的作品（{{ me.artworkCount }}）</h2>
        <div v-if="!items.length" class="empty card">
          <p>還沒有作品</p>
          <RouterLink to="/create" class="btn primary"><Icon name="brush" /> 做第一張長輩圖</RouterLink>
        </div>
        <div v-else class="mine-grid">
          <RouterLink
            v-for="a in items"
            :key="a.id"
            :to="`/artworks/${a.id}`"
            class="mine-item"
            :aria-label="`作品：${a.sloganText.replace(/\n/g, ' ')}，${a.likeCount} 個愛心，${a.downloadCount} 次下載`"
          >
            <img :src="a.imageUrl" alt="" loading="lazy" @error="onImgError" />
            <span class="mine-stats" aria-hidden="true">♥ {{ a.likeCount }} · ⬇ {{ a.downloadCount }}</span>
          </RouterLink>
        </div>
        <button v-if="page < totalPages" type="button" class="btn block more" :disabled="more" @click="loadMore">
          {{ more ? '載入中…' : '看更多' }}
        </button>
      </section>
    </template>

    <h2 class="section-title">設定</h2>
    <div class="list">
      <button type="button" class="list-row" @click="pickUser = true">
        <Icon name="user" />
        <span class="grow">示範帳號</span>
        <span class="muted">{{ demoUser }}</span>
        <Icon name="chevron-right" :size="20" />
      </button>
      <button v-if="apiMode === 'mock'" type="button" class="list-row" @click="reset">
        <Icon name="refresh" />
        <span class="grow">重設示範資料</span>
      </button>
    </div>

    <BottomSheet :open="pickUser" title="切換示範帳號" @close="pickUser = false">
      <div class="list" role="radiogroup" aria-label="示範帳號">
        <button
          v-for="u in demoUsers"
          :key="u"
          type="button"
          role="radio"
          class="list-row"
          :aria-checked="u === demoUser"
          @click="choose(u)"
        >
          <span class="grow">{{ u }}</span>
          <Icon v-if="u === demoUser" name="check" />
        </button>
      </div>
      <p class="small muted note">Demo 環境以 X-Demo-User 識別使用者，正式版會改接台北通登入。</p>
    </BottomSheet>

    <BottomSheet :open="showBadges" title="十級徽章" @close="showBadges = false">
      <ol class="list badge-list">
        <li v-for="b in BADGES" :key="b.level" class="list-row" :class="{ got: count >= b.threshold }">
          <img :src="badgeIconDataUrl(b.level)" alt="" width="36" height="36" />
          <span class="grow">
            <span class="row-title">Lv.{{ b.level }} {{ b.name }}</span>
            <span class="small muted block">累積 {{ b.threshold }} 張</span>
          </span>
          <span class="small" :class="count >= b.threshold ? 'got-label' : 'muted'">
            {{ count >= b.threshold ? '已取得' : '未取得' }}
          </span>
        </li>
      </ol>
    </BottomSheet>
  </div>
</template>

<style scoped>
.profile {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.who {
  display: flex;
  align-items: center;
  gap: 14px;
}
.who .grow {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.avatar {
  flex: none;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--tp-primary-300), var(--tp-primary-500));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  font-weight: 700;
}
.name {
  font-size: var(--tp-font-h2);
  line-height: var(--tp-lh-h2);
  font-weight: 600;
}
.stat-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  border-radius: var(--radius-m);
  background: var(--tp-grey-50);
}
.stat strong {
  font-size: var(--tp-font-h2);
  line-height: var(--tp-lh-h2);
  color: var(--tp-primary-700);
}
.progress-label {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.progress {
  height: 10px;
  border-radius: 5px;
  background: var(--tp-grey-100);
  overflow: hidden;
}
.progress span {
  display: block;
  height: 100%;
  border-radius: 5px;
  background: linear-gradient(90deg, var(--tp-primary-400), var(--tp-secondary-500));
}
span.block {
  display: block;
}
.row-title {
  display: block;
  font-weight: 600;
}
.bg-thumb {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
  filter: grayscale(0.6);
}
.mine-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.mine-item {
  position: relative;
  display: block;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 1;
  background: var(--tp-grey-100);
}
.mine-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.mine-stats {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px 6px 4px;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
}
.more {
  margin-top: 12px;
}
.empty.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.err-acts {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 12px;
}
.badge-list {
  list-style: none;
  margin: 0;
  padding: 0;
  box-shadow: none;
}
.badge-list li:not(.got) img {
  filter: grayscale(1);
  opacity: 0.5;
}
.got-label {
  color: var(--tp-primary-700);
  font-weight: 600;
}
.note {
  margin-top: 10px;
}
</style>
