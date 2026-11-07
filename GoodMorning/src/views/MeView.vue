<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { api, apiMode, demoUser, demoUsers, resetMockData, setDemoUser, townPassAccount } from '../api'
import { friendlyMessage } from '../api/errors'
import type { Artwork, Background, CurrentUser } from '../api/types'
import BadgeCelebration from '../components/BadgeCelebration.vue'
import BadgeDetail from '../components/BadgeDetail.vue'
import BottomSheet from '../components/BottomSheet.vue'
import Icon from '../components/Icon.vue'
import { BADGES, badgeArtUrl, nextBadge } from '../config/badges'
import { playCelebration, setSound, soundOn, unlockAudio } from '../composables/sound'
import { motionOn, setMotion } from '../composables/motion'
import { announce, toast } from '../composables/toast'
import { catalogBackgrounds, loadBackgroundCatalog } from '../data/backgrounds'
import { cancelDailyReminder, getDailyReminder, inTownPass, setDailyReminder } from '../composables/bridge'

const me = ref<CurrentUser | null>(null)
const backgrounds = ref<Background[]>([])
const items = ref<Artwork[]>([])
const page = ref(0)
const totalPages = ref(0)
const loading = ref(true)
const more = ref(false)
const error = ref<string | null>(null)
const pickUser = ref(false)
/** 徽章視窗：null＝關閉；list＝十級徽章清單；detail＝單一徽章放大（fromList 時可回到清單） */
type BadgeSheet = { mode: 'list' } | { mode: 'detail'; level: number; fromList: boolean }
const badgeSheet = ref<BadgeSheet | null>(null)
const badgeBody = ref<HTMLElement | null>(null)
/** 重看慶祝動畫 */
const celebrate = ref<{ level: number; name: string } | null>(null)
const badgeSheetTitle = computed(() => {
  const s = badgeSheet.value
  if (s?.mode === 'detail') return `Lv.${s.level} ${BADGES.find((b) => b.level === s.level)?.name ?? ''}`
  return '十級徽章'
})

/** 切換清單／放大時，原本被點的按鈕會消失，把焦點移到內容區，鍵盤與讀報軟體才不會掉到頁面最上面 */
async function showBadgeSheet(s: BadgeSheet) {
  badgeSheet.value = s
  await nextTick()
  badgeBody.value?.focus()
}

function replayCelebration(level: number) {
  unlockAudio() // 從「看慶祝動畫」按鈕的點擊直接進來，趁這個點擊解鎖聲音
  const def = BADGES.find((b) => b.level === level)
  badgeSheet.value = null
  if (def) celebrate.value = { level: def.level, name: def.name }
}

/** 慶祝音效：預設開啟；重新打開時立刻播一次讓人知道是什麼聲音（這次點擊同時解鎖瀏覽器的聲音限制） */
function onSoundToggle(e: Event) {
  const on = (e.target as HTMLInputElement).checked
  setSound(on)
  if (on) {
    unlockAudio()
    playCelebration()
  }
}

function onMotionToggle(e: Event) {
  setMotion((e.target as HTMLInputElement).checked)
}

async function load() {
  loading.value = true
  announce('載入中')
  error.value = null
  try {
    const [u, arts, cat] = await Promise.all([
      api.getCurrentUser(),
      api.listMyArtworks(0, 12),
      loadBackgroundCatalog().catch(() => null),
    ])
    // 背景與解鎖由前端圖庫決定，依這位使用者的作品數計算；圖庫載入失敗才退回後端清單
    const bgs = cat ? catalogBackgrounds(cat.backgrounds, u.artworkCount) : await api.listBackgrounds()
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
/** 進度條比例與旁邊的「x/y 張」一致：累積作品數 ÷ 下一個徽章門檻 */
const progress = computed(() => {
  if (!next.value) return 100
  return Math.min(100, Math.round((count.value / next.value.threshold) * 100))
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

/* ---------- 每天早上提醒（台北通 App 的 daily_reminder handler） ---------- */
type ReminderState = 'unavailable' | 'unsupported' | 'loading' | 'ready'
const reminderState = ref<ReminderState>(inTownPass() ? 'loading' : 'unavailable')
const reminderOn = ref(false)
const reminderBusy = ref(false)
const reminderTime = ref('07:00')

const pad = (n: number) => String(n).padStart(2, '0')
const reminderHint = computed(() => {
  switch (reminderState.value) {
    case 'unavailable':
      return '在台北通 App 裡打開才能設定提醒'
    case 'unsupported':
      return '這個版本的台北通 App 還不支援提醒'
    case 'loading':
      return '讀取中…'
    default:
      return reminderOn.value ? `每天 ${reminderTime.value} 用通知叫你來做早安圖` : '每天早上用手機通知提醒你做一張早安圖'
  }
})

async function loadReminder() {
  if (!inTownPass()) return
  const st = await getDailyReminder()
  if (!st) {
    reminderState.value = 'unsupported'
    return
  }
  reminderOn.value = st.enabled
  if (st.enabled && st.hour != null) reminderTime.value = `${pad(st.hour)}:${pad(st.minute ?? 0)}`
  reminderState.value = 'ready'
}

async function applyReminder(on: boolean) {
  if (reminderState.value !== 'ready' || reminderBusy.value) return
  reminderBusy.value = true
  try {
    if (on) {
      const [h, m] = reminderTime.value.split(':').map(Number)
      const st = await setDailyReminder({
        hour: Number.isFinite(h) ? h : 7,
        minute: Number.isFinite(m) ? m : 0,
        title: '早安！今天的早安圖做了嗎？',
        content: '挑一條市政好消息，做成長輩圖分享給家人',
      })
      if (st?.enabled) {
        reminderOn.value = true
        toast(`好，每天 ${reminderTime.value} 提醒你`, 'success')
      } else {
        reminderOn.value = false
        toast(st?.permission === false ? '需要允許台北通傳送通知，請到手機設定打開' : '提醒設定失敗，請再試一次', 'error')
      }
    } else {
      await cancelDailyReminder()
      reminderOn.value = false
      toast('已關閉每日提醒', 'success')
    }
  } finally {
    reminderBusy.value = false
  }
}

function onReminderToggle(e: Event) {
  const el = e.target as HTMLInputElement
  const want = el.checked
  el.checked = reminderOn.value // 等 App 回覆再改狀態
  applyReminder(want)
}

function onTimeChange() {
  if (reminderOn.value) applyReminder(true)
}

onMounted(() => {
  load()
  loadReminder()
})
</script>

<template>
  <div class="page">
    <div v-if="loading && !me" class="card profile skeleton" style="height: 160px" aria-busy="true" />
    <div v-else-if="error" class="empty" role="alert">
      <p>{{ error }}</p>
      <div class="err-acts">
        <button class="btn primary" type="button" @click="load"><Icon name="refresh" /> 再試一次</button>
        <button v-if="!townPassAccount" class="btn" type="button" @click="pickUser = true">切換示範帳號</button>
      </div>
    </div>
    <template v-else-if="me">
      <section class="card profile" aria-labelledby="me-name">
        <div class="who">
          <span class="avatar" aria-hidden="true">{{ me.displayName.slice(0, 1) }}</span>
          <div class="grow">
            <h2 id="me-name" class="name">{{ me.displayName }}</h2>
            <p v-if="me.badge" class="badge-line">Lv.{{ me.badge.level }} {{ me.badge.name }}</p>
            <p v-else class="muted">儲存第一張作品就能拿到徽章</p>
          </div>
          <button
            v-if="me.badge"
            type="button"
            class="hero-badge"
            :aria-label="`放大看徽章：Lv.${me.badge.level} ${me.badge.name}`"
            @click="showBadgeSheet({ mode: 'detail', level: me.badge.level, fromList: false })"
          >
            <img :src="badgeArtUrl(me.badge.level)" alt="" />
          </button>
          <span v-else class="hero-badge empty" aria-hidden="true"><Icon name="lock" :size="40" /></span>
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
            :aria-valuenow="me.artworkCount"
            aria-valuemin="0"
            :aria-valuemax="next.threshold"
            :aria-valuetext="`${me.artworkCount}/${next.threshold} 張`"
            :aria-label="`距離下一個徽章還差 ${next.threshold - me.artworkCount} 張`"
          >
            <span :style="{ width: progress + '%' }" />
          </div>
        </div>
        <p v-else class="small">已經拿到最高等級徽章，太厲害了！</p>
        <button type="button" class="btn text block" @click="showBadgeSheet({ mode: 'list' })">
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
            <span class="mine-stats" aria-hidden="true">
              <span><Icon name="heart" :size="20" filled /> {{ a.likeCount }}</span>
              <span><Icon name="download" :size="20" /> {{ a.downloadCount }}</span>
            </span>
          </RouterLink>
        </div>
        <button v-if="page < totalPages" type="button" class="btn block more" :disabled="more" @click="loadMore">
          {{ more ? '載入中…' : '看更多' }}
        </button>
      </section>
    </template>

    <h2 class="section-title">設定</h2>
    <div class="list">
      <label class="list-row reminder-row" :class="{ off: reminderState !== 'ready' }">
        <Icon name="bell" />
        <span class="grow">
          每天早上提醒我
          <span class="small muted block" aria-live="polite">{{ reminderHint }}</span>
        </span>
        <span class="switch-state" aria-hidden="true">{{ reminderOn ? '開' : '關' }}</span>
        <input
          type="checkbox"
          role="switch"
          class="switch"
          :checked="reminderOn"
          :disabled="reminderState !== 'ready' || reminderBusy"
          aria-label="每天早上提醒我"
          @change="onReminderToggle"
        />
      </label>
      <label v-if="reminderState === 'ready' && reminderOn" class="list-row">
        <span class="grow">提醒時間</span>
        <input
          v-model="reminderTime"
          type="time"
          class="time-input"
          step="300"
          :disabled="reminderBusy"
          @change="onTimeChange"
        />
      </label>
      <label class="list-row">
        <Icon name="volume" />
        <span class="grow">
          慶祝音效
          <span class="small muted block">拿到新徽章時播放歡樂音效和一句稱讚；不想聽可以關掉</span>
        </span>
        <span class="switch-state" aria-hidden="true">{{ soundOn ? '開' : '關' }}</span>
        <input type="checkbox" role="switch" class="switch" :checked="soundOn" aria-label="慶祝音效" @change="onSoundToggle" />
      </label>
      <label class="list-row">
        <Icon name="sparkle" />
        <span class="grow">
          動畫效果
          <span class="small muted block">關閉後，慶祝畫面等動畫不再播放</span>
        </span>
        <span class="switch-state" aria-hidden="true">{{ motionOn ? '開' : '關' }}</span>
        <input type="checkbox" role="switch" class="switch" :checked="motionOn" aria-label="動畫效果" @change="onMotionToggle" />
      </label>
      <div v-if="townPassAccount && apiMode === 'mock'" class="list-row">
        <Icon name="user" />
        <span class="grow">
          台北通帳號
          <span class="small muted block">作品會公開顯示你的台北通暱稱，不會顯示真實姓名</span>
        </span>
        <span class="muted">已連結</span>
      </div>
      <button v-else type="button" class="list-row" @click="pickUser = true">
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

    <BottomSheet :open="!!badgeSheet" :title="badgeSheetTitle" @close="badgeSheet = null">
      <div ref="badgeBody" class="sheet-body" tabindex="-1">
        <BadgeDetail
          v-if="badgeSheet?.mode === 'detail'"
          :level="badgeSheet.level"
          :count="count"
          :from-list="badgeSheet.fromList"
          @replay="replayCelebration(badgeSheet.level)"
          @back="showBadgeSheet({ mode: 'list' })"
        />
        <ol v-else class="list badge-list">
          <li v-for="b in BADGES" :key="b.level">
            <button
              type="button"
              class="list-row badge-row"
              :class="{ got: count >= b.threshold }"
              @click="showBadgeSheet({ mode: 'detail', level: b.level, fromList: true })"
            >
              <img :src="badgeArtUrl(b.level)" alt="" width="56" height="56" loading="lazy" />
              <span class="grow">
                <span class="row-title">Lv.{{ b.level }} {{ b.name }}</span>
                <span class="small muted block">累積 {{ b.threshold }} 張</span>
              </span>
              <span class="small" :class="count >= b.threshold ? 'got-label' : 'muted'">
                {{ count >= b.threshold ? '已取得' : '未取得' }}
              </span>
              <Icon name="chevron-right" :size="20" />
              <span class="visually-hidden">，點一下放大看徽章</span>
            </button>
          </li>
        </ol>
      </div>
    </BottomSheet>

    <BadgeCelebration :badge="celebrate" @close="celebrate = null" />
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
  min-width: 0;
}
.badge-line {
  font-size: 1.125rem;
  line-height: 1.5rem;
  font-weight: 700;
  color: var(--tp-secondary-800);
}
/* 目前徽章：大圖放在右邊，點一下可以放大 */
.hero-badge {
  flex: none;
  width: 112px;
  height: 112px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.2));
}
.hero-badge img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.hero-badge:active {
  transform: scale(0.96);
}
.hero-badge.empty {
  border: 3px dashed var(--tp-grey-300);
  color: var(--tp-grey-500);
  filter: none;
}
@media (max-width: 380px) {
  .avatar {
    display: none;
  }
  .hero-badge {
    width: 96px;
    height: 96px;
  }
}
.avatar {
  flex: none;
  width: 56px;
  height: 56px;
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
  height: 16px;
  border-radius: 8px;
  background: var(--tp-grey-200);
  overflow: hidden;
}
.progress span {
  display: block;
  height: 100%;
  border-radius: 8px;
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
/* 兩欄：長輩手機上每張作品約 180px 寬，字才看得清楚（原本三欄約 120px） */
.mine-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
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
  display: flex;
  gap: 14px;
  padding: 28px 10px 8px;
  color: #fff;
  font-size: 1.125rem;
  line-height: 1.5rem;
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
}
.mine-stats span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
.sheet-body {
  outline: none;
}
/* li 包住按鈕後，相鄰列的分隔線要改畫在 li 之間 */
.badge-list li + li .badge-row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 16px;
  right: 0;
  border-top: 1px solid var(--c-line);
}
.badge-row {
  min-height: 76px;
}
.badge-row img {
  flex: none;
  border-radius: 50%;
  object-fit: contain;
}
.badge-row:not(.got) img {
  filter: grayscale(1);
  opacity: 0.55;
}
.got-label {
  color: var(--tp-primary-700);
  font-weight: 600;
}
.note {
  margin-top: 10px;
}
.reminder-row {
  cursor: pointer;
}
.reminder-row.off {
  cursor: default;
}
.time-input {
  font: inherit;
  font-size: var(--tp-font-h3, 1.125rem);
  color: var(--tp-primary-700);
  border: 1px solid var(--tp-grey-200);
  border-radius: var(--radius-s, 8px);
  padding: 8px 10px;
  min-height: 44px;
  background: #fff;
}
</style>
