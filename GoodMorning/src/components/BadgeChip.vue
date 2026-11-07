<script setup lang="ts">
import type { Badge } from '../api/types'

defineProps<{ badge?: Badge | null; compact?: boolean }>()
</script>

<template>
  <span v-if="badge" class="badge" :class="{ compact }" :title="`Lv.${badge.level} ${badge.name}`">
    <img :src="badge.iconUrl" alt="" width="20" height="20" />
    <span v-if="!compact">Lv.{{ badge.level }} {{ badge.name }}</span>
    <span v-else class="visually-hidden">徽章 Lv.{{ badge.level }} {{ badge.name }}</span>
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px 2px 4px;
  border-radius: 4px;
  background: var(--c-accent-soft);
  color: var(--tp-secondary-800);
  font-size: var(--tp-font-body);
  line-height: var(--tp-lh-body);
  font-weight: 600;
  white-space: nowrap;
}
.badge.compact {
  padding: 2px;
}
.badge img {
  width: 20px;
  height: 20px;
}
</style>
