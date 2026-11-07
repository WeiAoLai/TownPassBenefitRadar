<script setup lang="ts">
import { computed, ref } from 'vue'
import { newPerson } from '../engine/personas'
import type { Household, Person, Role } from '../engine/types'

const props = defineProps<{ household: Household }>()
const emit = defineEmits<{ done: [h: Household]; back: [] }>()

const people = ref<Person[]>(props.household.people.map((p) => ({ ...p })))

const addable: { role: Role; label: string; once?: boolean }[] = [
  { role: 'spouse', label: '配偶', once: true },
  { role: 'father', label: '爸爸', once: true },
  { role: 'mother', label: '媽媽', once: true },
  { role: 'child', label: '子女' },
  { role: 'grandparent', label: '祖父母' },
  { role: 'grandchild', label: '孫子女' },
  { role: 'sibling', label: '兄弟姊妹' },
]

const has = (role: Role) => people.value.some((p) => p.role === role)

function add(role: Role) {
  const count = people.value.filter((p) => p.role === role).length
  const p = newPerson(role)
  if (count > 0 || role === 'child') p.name = `${p.name}${count + 1}`
  people.value.push(p)
}

function remove(id: string) {
  people.value = people.value.filter((p) => p.id !== id)
}

function setAge(p: Person, v: string) {
  const n = Number(v)
  p.age = v === '' || !isFinite(n) ? null : Math.max(0, Math.min(120, Math.round(n)))
}

const ready = computed(() => people.value.every((p) => p.age !== null))

function done() {
  const married = people.value.some((p) => p.role === 'spouse')
  const next = people.value.map((p) => (p.role === 'self' ? { ...p, married } : p))
  emit('done', { ...props.household, people: next })
}
</script>

<template>
  <main class="page stack">
    <button class="btn ghost back no-print" @click="$emit('back')">← 回首頁</button>
    <header>
      <h1 class="h1">你的家裡有誰？</h1>
      <p class="muted">
        包含<strong>沒住在一起</strong>的家人。不同補助會把不同的人算進來，所以先全部列出來，
        我們再幫你分。有身心障礙證明的家人請選等級。
      </p>
    </header>

    <section class="card stack">
      <div v-for="p in people" :key="p.id" class="row">
        <span class="avatar" aria-hidden="true">{{ p.name.slice(0, 1) }}</span>
        <label class="name" :for="`age-${p.id}`">
          {{ p.name }}
          <span v-if="p.age !== null" class="tag">{{ p.age < 18 ? '未成年' : '成年' }}</span>
        </label>
        <span class="age">
          <input
            :id="`age-${p.id}`"
            type="number"
            inputmode="numeric"
            min="0"
            max="120"
            placeholder="年齡"
            :value="p.age ?? ''"
            @input="setAge(p, ($event.target as HTMLInputElement).value)"
          />
          <span class="muted small">歲</span>
        </span>
        <button
          v-if="p.role !== 'self'"
          class="remove"
          :aria-label="`移除${p.name}`"
          @click="remove(p.id)"
        >
          ✕
        </button>
        <span v-else class="remove-spacer" />
        <select v-model="p.disability" class="dis" :aria-label="`${p.name}的身心障礙證明`">
          <option value="none">沒有身心障礙證明</option>
          <option value="mild">身心障礙證明：輕度</option>
          <option value="moderate">身心障礙證明：中度</option>
          <option value="severe">身心障礙證明：重度</option>
          <option value="profound">身心障礙證明：極重度</option>
        </select>
      </div>
    </section>

    <section>
      <p class="muted small add-title">新增家人</p>
      <div class="chips">
        <button
          v-for="a in addable"
          :key="a.role"
          class="chip"
          :disabled="a.once && has(a.role)"
          @click="add(a.role)"
        >
          ＋ {{ a.label }}
        </button>
      </div>
    </section>

    <button class="btn primary" :disabled="!ready" @click="done">
      {{ ready ? '下一步' : '請填每個人的年齡' }}
    </button>
  </main>
</template>

<style scoped>
.back {
  justify-content: flex-start;
  width: auto;
  padding-left: 0;
}
.h1 {
  font-size: 1.6rem;
}
header p {
  margin: 6px 0 0;
}
.row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto 44px;
  align-items: center;
  row-gap: 8px;
  column-gap: 10px;
}
.avatar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 700;
}
.name {
  font-weight: 600;
  white-space: nowrap;
}
.tag {
  margin-left: 4px;
  padding: 0 6px;
  border-radius: 6px;
  background: var(--surface-2);
  color: var(--text-2);
  font-size: 0.75rem;
  font-weight: 600;
}
.dis {
  grid-column: 2 / 5;
  min-width: 0;
  width: 100%;
  min-height: 44px;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 0.9rem;
}
.row + .row {
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.age {
  display: flex;
  align-items: center;
  gap: 6px;
}
.age input {
  width: 84px;
  min-height: 48px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-2);
  text-align: center;
}
.remove {
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-2);
}
.add-title {
  margin: 0 0 8px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  min-height: 48px;
  padding: 8px 16px;
  border: 1px dashed var(--accent);
  border-radius: 999px;
  background: transparent;
  color: var(--accent);
  font-weight: 600;
}
.chip:disabled {
  opacity: 0.35;
  border-style: solid;
}
</style>
