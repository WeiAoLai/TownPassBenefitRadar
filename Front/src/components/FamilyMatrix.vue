<script setup lang="ts">
import { computed } from 'vue'
import type { Evaluation, Household } from '../engine/types'

const props = defineProps<{ household: Household; evaluation: Evaluation }>()

type Cell = 'in' | 'maybe' | 'out'
// 只放「看全家」的補助；只看本人的（敬老卡、育兒津貼等）放進表格沒有意義
const familyPrograms = ['rent300', 'low', 'mid', 'senior', 'disability', 'specialKids']
const rows = computed(() =>
  props.evaluation.results.filter((r) => familyPrograms.includes(r.program)).map((r) => {
    const inc = new Set(r.scope.included.map((m) => m.id))
    const may = new Set(r.scope.maybeExcluded.map((m) => m.id))
    return {
      id: r.id,
      name: r.program === 'specialKids' ? '特殊境遇' : r.short,
      count: inc.size,
      cells: props.household.people.map<Cell>((p) => (inc.has(p.id) ? 'in' : may.has(p.id) ? 'maybe' : 'out')),
    }
  }),
)
const cellText: Record<Cell, string> = { in: '算進來', maybe: '可能排除', out: '不算' }
</script>

<template>
  <section class="card matrix">
    <h2 class="h2">同一個家，{{ rows.length }} 種家庭</h2>
    <p class="muted small sub">每個補助把誰算進「你的家」都不一樣。亮的是會被算進來的人。</p>
    <div class="scroll">
      <table>
        <caption class="sr-only">各補助認定的家庭成員</caption>
        <thead>
          <tr>
            <th scope="col"><span class="sr-only">補助</span></th>
            <th v-for="p in household.people" :key="p.id" scope="col">
              <span class="avatar head">{{ p.name.slice(0, 1) }}</span>
              <span class="pname">{{ p.name }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <th scope="row">
              {{ r.name }}<br /><span class="muted small">算 {{ r.count }} 人</span>
            </th>
            <td v-for="(c, i) in r.cells" :key="i">
              <span class="avatar" :class="c" :title="cellText[c]">
                {{ household.people[i].name.slice(0, 1) }}
              </span>
              <span class="sr-only">{{ cellText[c] }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="legend small muted">
      <span class="avatar in mini" />算進來
      <span class="avatar maybe mini" />可能排除（要社工評估）
      <span class="avatar out mini" />不算
    </p>
  </section>
</template>

<style scoped>
.h2 {
  font-size: 1.2rem;
}
.sub {
  margin: 4px 0 12px;
}
.scroll {
  overflow-x: auto;
}
table {
  border-collapse: separate;
  border-spacing: 0 6px;
  width: 100%;
}
th,
td {
  text-align: center;
  padding: 0 4px;
}
tbody th {
  text-align: left;
  font-size: 0.9rem;
  min-width: 5.5em;
  padding-right: 8px;
  line-height: 1.25;
}
thead th {
  font-weight: 600;
  font-size: 0.75rem;
  vertical-align: bottom;
}
.pname {
  display: block;
  color: var(--text-2);
  white-space: nowrap;
}
.avatar {
  display: inline-grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-weight: 700;
  font-size: 0.95rem;
}
.avatar.head {
  background: var(--surface-2);
  color: var(--text);
}
.avatar.in {
  background: var(--accent);
  color: var(--accent-ink);
}
.avatar.maybe {
  background: transparent;
  color: var(--maybe);
  border: 2px dashed var(--maybe);
}
.avatar.out {
  background: var(--surface-2);
  color: var(--line);
}
.avatar.mini {
  width: 14px;
  height: 14px;
  margin: 0 4px 0 10px;
  vertical-align: -2px;
}
.avatar.mini:first-child {
  margin-left: 0;
}
.legend {
  margin: 8px 0 0;
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
