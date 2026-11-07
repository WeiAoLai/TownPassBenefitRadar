<script setup lang="ts">
import { computed } from 'vue'
import params from '../../rules/params-115.json'
import programs from '../../rules/programs.json'
import { openLink, phoneCall } from '../bridge'
import { getQuestion } from '../engine/questions'
import { money } from '../engine/range'
import type { Household, ProgramResult, Tri } from '../engine/types'

const props = defineProps<{ result: ProgramResult; household: Household }>()

const prog = computed(() => programs[props.result.program])
const keyNote = computed(() => (programs[props.result.program] as { keyNote?: string }).keyNote ?? '')
const checklist = computed(
  () =>
    programs[props.result.program].checklist as {
      where: string
      link?: string
      phone: string
      docs: string[]
      tips: string[]
    },
)
const statusText = { likely: '可以申請', maybe: '還要確認', no: '不符合' }
const icon: Record<Tri, string> = { pass: '✓', fail: '✕', unknown: '?' }
const cites = params.cites as Record<string, { title: string; url: string }>

const applicantText = computed(() => {
  const r = props.result
  if (r.program === 'low' || r.program === 'mid') return '全戶一起申請'
  const p = props.household.people.find((x) => x.id === r.applicant)
  return `申請人：${p?.name ?? '你'}`
})
const questions = computed(() =>
  props.result.needs.map((k) => {
    try {
      return getQuestion(props.household, k).title
    } catch {
      return k
    }
  }),
)
const amountText = computed(() => {
  const a = props.result.amount
  if (!a) return { prefix: '', value: '' }
  const unit = a.unit === '點/月' ? ' 點' : ' 元'
  const fmt = (n: number) => money(n).replace(' 元', '')
  const value = (a.min === a.max ? fmt(a.min) : `${fmt(a.min)}～${fmt(a.max)}`) + unit
  return { prefix: a.unit === '元（一次）' ? '一次' : '每月', value }
})
const scopeText = computed(() => {
  const s = props.result.scope
  let t = s.included.map((m) => m.name).join('、')
  if (s.maybeExcluded.length) t += `；${s.maybeExcluded.map((m) => m.name).join('、')}可能排除`
  return t
})
</script>

<template>
  <article class="card program" :class="[result.status, result.conflict && !result.conflict.chosen ? 'skip' : '']">
    <header class="head">
      <div>
        <h3>{{ result.name }}</h3>
        <p class="who small muted">{{ applicantText }}</p>
      </div>
      <span class="badge" :class="result.status">{{ statusText[result.status] }}</span>
    </header>

    <p v-if="result.amount && result.status !== 'no'" class="amount">
      {{ amountText.prefix }} <strong>{{ amountText.value }}</strong>
    </p>
    <p v-else-if="result.status !== 'no' && keyNote" class="identity small">{{ keyNote }}</p>
    <p v-if="!(result.status === 'likely' && result.amount)" class="headline">{{ result.headline }}</p>

    <p v-if="result.conflict" class="conflict small" :class="{ chosen: result.conflict.chosen }">
      {{ result.conflict.chosen ? '👍 建議選這項：' : '⚠️ 只能擇一：' }}{{ result.conflict.note }}
    </p>

    <section v-if="result.impacts.length && result.status !== 'no'" class="impacts">
      <h4>申請後對家人的影響</h4>
      <ul>
        <li v-for="t in result.impacts" :key="t">{{ t }}</li>
      </ul>
    </section>

    <div v-if="questions.length" class="todo small">
      <strong>還不確定的事</strong>
      <ul>
        <li v-for="t in questions" :key="t">{{ t }}</li>
      </ul>
    </div>

    <details class="more">
      <summary>為什麼這樣判斷</summary>
      <div class="stack small">
        <p class="family">
          <strong>這個補助算進「家」的人：</strong>{{ scopeText }}<br />
          <span class="muted">{{ prog.familyRule }}</span>
        </p>
        <ul class="criteria">
          <li v-for="c in result.criteria" :key="c.id" :class="c.tri">
            <span class="icon" aria-hidden="true">{{ icon[c.tri] }}</span>
            <div>
              <strong>{{ c.label }}</strong>
              <span v-if="c.gap && c.tri === 'fail'" class="gap">差在哪：{{ c.gap }}</span>
              <p class="muted detail">
                {{ c.detail }}
                <a v-if="cites[c.cite]" href="#" @click.prevent="openLink(cites[c.cite].url)">法源</a>
              </p>
            </div>
          </li>
        </ul>
        <p v-if="result.amount" class="muted">{{ result.amount.note }}</p>
        <p v-if="result.amount && keyNote" class="muted">{{ keyNote }}</p>
      </div>
    </details>

    <details v-if="result.status !== 'no'" class="more">
      <summary>怎麼申請、要帶什麼</summary>
      <div class="stack">
        <p><strong>去哪裡：</strong>{{ checklist.where }}</p>
        <div>
          <strong>準備文件：</strong>
          <ul>
            <li v-for="d in checklist.docs" :key="d">{{ d }}</li>
          </ul>
        </div>
        <ul class="tips">
          <li v-for="t in checklist.tips" :key="t">💡 {{ t }}</li>
        </ul>
        <div class="actions no-print">
          <button class="btn" @click="phoneCall(checklist.phone)">撥打 {{ checklist.phone }} 詢問</button>
          <button v-if="checklist.link" class="btn" @click="openLink(checklist.link!)">開啟申請網站</button>
        </div>
      </div>
    </details>
  </article>
</template>

<style scoped>
.program {
  border-left: 6px solid var(--line);
}
.program.likely {
  border-left-color: var(--ok);
}
.program.maybe {
  border-left-color: var(--maybe);
}
.program.no {
  border-left-color: var(--no);
}
.program.skip {
  opacity: 0.8;
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
h3 {
  font-size: 1.1rem;
}
.who {
  margin: 2px 0 0;
}
.amount {
  margin: 10px 0 0;
}
.amount strong {
  font-size: 1.6rem;
  color: var(--ok);
}
.maybe .amount strong {
  color: var(--maybe);
}
.identity {
  margin: 10px 0 0;
}
.headline {
  margin: 4px 0 0;
  font-weight: 600;
}
.conflict {
  margin: 10px 0 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--maybe-soft);
  color: var(--text);
}
.conflict.chosen {
  background: var(--ok-soft);
}
.impacts {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--surface-2);
}
.impacts h4 {
  margin: 0;
  font-size: 0.95rem;
}
.impacts ul,
.todo ul,
.more ul {
  margin: 4px 0 0;
  padding-left: 1.2em;
}
.impacts li {
  margin-top: 4px;
  font-size: 0.9rem;
}
.todo {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--maybe-soft);
}
.more {
  margin-top: 10px;
  border-top: 1px solid var(--line);
}
summary {
  min-height: 48px;
  display: flex;
  align-items: center;
  font-weight: 700;
  color: var(--accent);
  cursor: pointer;
}
.family {
  margin: 0;
}
.criteria {
  margin: 0;
  padding: 0 !important;
  list-style: none;
}
.criteria li {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px solid var(--line);
}
.icon {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  font-weight: 800;
  font-size: 0.85rem;
}
.pass .icon {
  background: var(--ok-soft);
  color: var(--ok);
}
.fail .icon {
  background: var(--no-soft);
  color: var(--no);
}
.unknown .icon {
  background: var(--maybe-soft);
  color: var(--maybe);
}
.gap {
  display: block;
  color: var(--no);
  font-weight: 600;
}
.detail {
  margin: 2px 0 0;
}
.tips {
  list-style: none;
  padding-left: 0 !important;
}
.actions {
  display: grid;
  gap: 8px;
}
@media print {
  details > *:not(summary) {
    display: block !important;
  }
}
</style>
