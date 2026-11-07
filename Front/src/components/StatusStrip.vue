<script setup lang="ts">
import type { Evaluation, Status } from '../engine/types'

defineProps<{ evaluation: Evaluation }>()

const label: Record<Status, string> = { likely: '很可能', maybe: '還在算', no: '不符合' }
</script>

<template>
  <ul class="strip" aria-label="目前試算狀態">
    <li v-for="r in evaluation.results" :key="r.id" :class="r.status">
      <span class="name">{{ r.short }}</span>
      <span class="state">{{ label[r.status] }}</span>
    </li>
  </ul>
</template>

<style scoped>
.strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 4px;
  border-radius: 10px;
  font-size: 0.75rem;
  line-height: 1.3;
  transition:
    background 0.3s,
    color 0.3s;
}
.name {
  font-weight: 700;
}
.likely {
  background: var(--ok-soft);
  color: var(--ok);
}
.maybe {
  background: var(--surface-2);
  color: var(--text-2);
}
.no {
  background: var(--no-soft);
  color: var(--no);
}
</style>
