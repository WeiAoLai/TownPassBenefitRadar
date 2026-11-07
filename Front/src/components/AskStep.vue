<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { affects } from '../engine/nextQuestion'
import { getQuestion } from '../engine/questions'
import type { Evaluation, FieldKey, Household } from '../engine/types'
import StatusStrip from './StatusStrip.vue'

const props = defineProps<{
  household: Household
  evaluation: Evaluation
  field: FieldKey
  answered: number
}>()
const emit = defineEmits<{ answer: [key: FieldKey, value: unknown]; skip: [key: FieldKey]; back: [] }>()

const q = computed(() => getQuestion(props.household, props.field))
const why = computed(() => affects(props.evaluation, props.field))
const num = ref('')
watch(
  () => props.field,
  () => (num.value = ''),
)

function submitNumber() {
  const n = Number(num.value)
  if (num.value === '' || !isFinite(n) || n < 0) return
  emit('answer', props.field, n)
}
</script>

<template>
  <main class="page stack">
    <div class="topbar no-print">
      <button class="btn ghost back" @click="$emit('back')">← 上一題</button>
      <span class="muted small">已回答 {{ answered }} 題</span>
    </div>

    <StatusStrip :evaluation="evaluation" />

    <section class="card stack" aria-live="polite">
      <h1 class="title">{{ q.title }}</h1>
      <p v-if="q.help" class="muted help">{{ q.help }}</p>

      <div v-if="q.kind === 'choice'" class="options">
        <button
          v-for="o in q.options"
          :key="o.label"
          class="btn"
          @click="$emit('answer', field, o.value)"
        >
          {{ o.label }}
        </button>
      </div>

      <form v-else class="number" @submit.prevent="submitNumber">
        <input
          v-model="num"
          type="number"
          inputmode="decimal"
          min="0"
          step="any"
          :aria-label="q.title"
          autofocus
        />
        <span class="unit">{{ q.unit }}</span>
        <button class="btn primary" type="submit" :disabled="num === ''">確定</button>
      </form>

      <p v-if="why.length" class="why small">這題會影響：{{ why.join('、') }}</p>
    </section>

    <button class="btn ghost" @click="$emit('skip', field)">我不知道，跳過</button>
  </main>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.back {
  width: auto;
  padding-left: 0;
}
.title {
  font-size: 1.35rem;
}
.help {
  margin: 6px 0 0;
}
.options {
  display: grid;
  gap: 10px;
}
.number {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
}
.number input {
  min-height: 56px;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-2);
  font-size: 1.3rem;
}
.number .btn {
  grid-column: 1 / -1;
}
.unit {
  font-weight: 600;
}
.why {
  margin: 0;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  color: var(--text-2);
}
</style>
