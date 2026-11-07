<script setup lang="ts">
import { computed, ref } from 'vue'
import params from '../../rules/params-115.json'
import programs from '../../rules/programs.json'
import { money } from '../engine/range'
import type { Persona } from '../engine/personas'
import type { Evaluation, Household, ProgramResult } from '../engine/types'
import FamilyMatrix from './FamilyMatrix.vue'
import ProgramCard from './ProgramCard.vue'

const props = defineProps<{
  household: Household
  evaluation: Evaluation
  demo: Persona | null
  answered: number
}>()
defineEmits<{ restart: []; back: [] }>()

const sources = Object.values(params.cites)
const print = () => window.print()

// ---- 搜尋 ----
const query = ref('')
const chips = ['租屋', '長輩', '身障', '育兒', '單親', '低收入']
function haystack(r: ProgramResult): string {
  const p = props.household.people.find((x) => x.id === r.applicant)
  const tags = (programs[r.program] as { tags?: string[] }).tags ?? []
  return [r.name, r.short, p?.name ?? '', ...tags].join(' ')
}
const shown = computed(() => {
  const q = query.value.trim()
  const rs = props.evaluation.results
  if (!q) return rs
  const words = q.split(/\s+/)
  return rs.filter((r) => words.every((w) => haystack(r).includes(w)))
})
const toggleChip = (c: string) => (query.value = query.value === c ? '' : c)

// ---- 分區：可以申請 → 還要確認 → 不符合（收起來） ----
const recommended = (r: ProgramResult) => !r.conflict || r.conflict.chosen
const can = computed(() => shown.value.filter((r) => r.status === 'likely' && recommended(r)))
const check = computed(() => shown.value.filter((r) => r.status === 'maybe' && recommended(r)))
const skipped = computed(() => shown.value.filter((r) => r.status !== 'no' && !recommended(r)))
const no = computed(() => shown.value.filter((r) => r.status === 'no'))

// ---- 摘要：只算「可以申請」且建議領的；每月、一次性、點數分開算 ----
const allCan = computed(() => props.evaluation.results.filter((r) => r.status === 'likely' && recommended(r)))
const allCheck = computed(() => props.evaluation.results.filter((r) => r.status === 'maybe' && recommended(r)))
function sumUnit(unit: string) {
  const rs = allCan.value.filter((r) => r.amount?.unit === unit)
  return { min: rs.reduce((s, r) => s + r.amount!.min, 0), max: rs.reduce((s, r) => s + r.amount!.max, 0), n: rs.length }
}
const monthly = computed(() => sumUnit('元/月'))
const once = computed(() => sumUnit('元（一次）'))
const points = computed(() => sumUnit('點/月'))
const range = (x: { min: number; max: number }) => (x.min === x.max ? money(x.min) : `${money(x.min)}～${money(x.max)}`)
</script>

<template>
  <main class="page stack">
    <div class="topbar no-print">
      <button class="btn ghost back" @click="$emit('back')">← 修改答案</button>
      <button class="btn ghost back" @click="$emit('restart')">重新開始</button>
    </div>

    <header>
      <p class="kicker">試算結果</p>
      <h1 class="h1">{{ demo ? demo.title : '你家可以申請的補助' }}</h1>
      <p v-if="demo" class="muted">{{ demo.story }}</p>
      <p v-else class="muted small">回答了 {{ answered }} 題。</p>
    </header>

    <section class="card summary">
      <p v-if="allCan.length" class="big">
        可以申請 <strong>{{ allCan.length }}</strong> 項
        <span v-if="allCheck.length" class="muted">，另有 {{ allCheck.length }} 項還要確認</span>
      </p>
      <p v-else-if="allCheck.length" class="big">
        有 <strong>{{ allCheck.length }}</strong> 項可能可以申請，還要先確認幾件事
      </p>
      <p v-else class="big">目前沒有找到符合的補助，下面列出每一項不符合的原因。</p>
      <p v-if="monthly.max > 0" class="sum">
        每月合計約 <strong>{{ range(monthly) }}</strong>
      </p>
      <p v-if="once.max > 0" class="sum">
        一次性補助約 <strong>{{ range(once) }}</strong>
      </p>
      <p v-if="points.n" class="sum small">另有敬老卡或愛心卡 {{ points.n }} 張，每張每月 600 點</p>
      <ul v-if="allCan.length" class="names">
        <li v-for="r in allCan" :key="r.id">{{ r.short }}</li>
      </ul>
      <p class="muted small note">
        只能擇一的補助已幫你選金額較高的那項；低收入戶、中低收入戶是身分，不直接算金額。
      </p>
    </section>

    <p v-for="t in evaluation.tips" :key="t" class="tip small">{{ t }}</p>

    <section class="search no-print">
      <label for="q" class="sr-only">搜尋補助</label>
      <input id="q" v-model="query" type="search" placeholder="搜尋補助，例如：租屋、長輩、身障、育兒" />
      <div class="chips">
        <button v-for="c in chips" :key="c" class="chip" :class="{ on: query === c }" @click="toggleChip(c)">
          {{ c }}
        </button>
      </div>
    </section>

    <p v-if="query && !shown.length" class="muted">找不到跟「{{ query }}」有關的補助。</p>

    <section v-if="can.length" class="stack">
      <h2 class="h2">✅ 可以申請（{{ can.length }}）</h2>
      <ProgramCard v-for="r in can" :key="r.id" :result="r" :household="household" />
    </section>

    <section v-if="check.length" class="stack">
      <h2 class="h2">🔍 可能可以，還要確認（{{ check.length }}）</h2>
      <ProgramCard v-for="r in check" :key="r.id" :result="r" :household="household" />
    </section>

    <section v-if="skipped.length" class="stack">
      <h2 class="h2">↔️ 符合但只能擇一，建議不用申請（{{ skipped.length }}）</h2>
      <ProgramCard v-for="r in skipped" :key="r.id" :result="r" :household="household" />
    </section>

    <details v-if="!query" class="card fold">
      <summary>為什麼每個補助把不同的家人算進來？</summary>
      <FamilyMatrix :household="household" :evaluation="evaluation" />
    </details>

    <details v-if="no.length" class="card fold">
      <summary>❌ 目前不符合（{{ no.length }} 項），點開看原因</summary>
      <ul class="nolist">
        <li v-for="r in no" :key="r.id">
          <details>
            <summary class="nosum">
              <span>
                <strong>{{ r.name }}</strong>
                <span class="reason">{{ r.headline.replace(/^不符合：/, '') }}</span>
              </span>
            </summary>
            <ProgramCard :result="r" :household="household" class="inner" />
          </details>
        </li>
      </ul>
    </details>

    <button class="btn primary no-print" @click="print">列印或存成 PDF（帶去區公所）</button>

    <footer class="muted small stack">
      <p>
        試算僅供參考，實際資格以主管機關審核為準。規則版本：臺北市 {{ params.version }} 年度，
        更新於 {{ params.updated }}。所有計算都在你的裝置上完成，沒有上傳任何資料。
      </p>
      <details>
        <summary>資料來源</summary>
        <ul>
          <li v-for="s in sources" :key="s.url">
            <a :href="s.url" target="_blank" rel="noopener">{{ s.title }}</a>
          </li>
        </ul>
      </details>
    </footer>
  </main>
</template>

<style scoped>
.topbar {
  display: flex;
  justify-content: space-between;
}
.back {
  width: auto;
  padding: 0;
}
.kicker {
  margin: 0;
  color: var(--accent);
  font-weight: 700;
  font-size: 0.9rem;
}
.h1 {
  font-size: 1.5rem;
}
.h2 {
  font-size: 1.15rem;
  margin-top: 8px;
}
header p {
  margin: 6px 0 0;
}
.summary {
  background: var(--accent-soft);
  border-color: transparent;
  box-shadow: none;
}
.summary p {
  margin: 0;
}
.big {
  font-size: 1.15rem;
}
.big strong {
  font-size: 1.6rem;
  color: var(--accent);
}
.sum {
  margin-top: 4px !important;
}
.sum strong {
  font-size: 1.4rem;
  color: var(--ok);
}
.names {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}
.names li {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--surface);
  font-size: 0.85rem;
  font-weight: 600;
}
.note {
  margin-top: 8px !important;
}
.tip {
  margin: 0;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--maybe-soft);
}
.search input {
  width: 100%;
  min-height: 52px;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  font-size: 1rem;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.chip {
  min-height: 44px;
  padding: 6px 16px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  font-weight: 600;
}
.chip.on {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
}
.fold {
  padding: 4px 18px;
}
.fold > summary {
  min-height: 56px;
  display: flex;
  align-items: center;
  font-weight: 700;
  cursor: pointer;
}
.fold :deep(.matrix) {
  border: 0;
  box-shadow: none;
  padding: 0 0 12px;
}
.nolist {
  margin: 0;
  padding: 0 0 12px;
  list-style: none;
}
.nolist > li {
  padding: 12px 0;
  border-top: 1px solid var(--line);
}
.nosum {
  min-height: 48px;
  cursor: pointer;
}
.reason {
  display: block;
  color: var(--no);
  font-size: 0.9rem;
}
.inner {
  margin-top: 8px;
  box-shadow: none;
}
footer p {
  margin: 0;
}
footer summary {
  min-height: 48px;
  display: flex;
  align-items: center;
  cursor: pointer;
}
footer ul {
  padding-left: 1.2em;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
