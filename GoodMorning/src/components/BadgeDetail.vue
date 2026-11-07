<script setup lang="ts">
/** 單一徽章的放大檢視：大圖、取得條件、取得狀態；取得後可重看慶祝動畫。放在 BottomSheet 內使用。 */
import { computed } from 'vue'
import { BADGES, badgeArtUrl } from '../config/badges'
import Icon from './Icon.vue'

const props = defineProps<{ level: number; count: number; fromList?: boolean }>()
const emit = defineEmits<{ replay: []; back: [] }>()

const def = computed(() => BADGES.find((b) => b.level === props.level) ?? BADGES[0])
const got = computed(() => props.count >= def.value.threshold)
const need = computed(() => Math.max(0, def.value.threshold - props.count))
</script>

<template>
  <div class="detail">
    <div class="art-wrap">
      <img class="art" :src="badgeArtUrl(def.level)" :alt="`Lv.${def.level} ${def.name} 徽章大圖`" />
    </div>
    <p class="status" :class="{ got }">
      <template v-if="got"><Icon name="check" :size="24" /> 你已經取得這個徽章</template>
      <template v-else>再儲存 {{ need }} 張作品就能取得</template>
    </p>
    <p class="note muted">累積 {{ def.threshold }} 張作品可以取得</p>
    <div class="acts">
      <button v-if="got" type="button" class="btn primary block large" @click="emit('replay')">看慶祝動畫</button>
      <button v-if="fromList" type="button" class="btn block large" @click="emit('back')">回到十級徽章</button>
    </div>
  </div>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding-top: 4px;
}
.art-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 8px 0;
  border-radius: var(--radius-m);
  background: radial-gradient(circle at 50% 50%, var(--tp-secondary-100) 0%, var(--tp-secondary-50) 55%, transparent 80%);
}
.art {
  width: min(100%, 320px);
  aspect-ratio: 1;
  object-fit: contain;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.25));
}
.status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 1.125rem;
  line-height: 1.5rem;
  font-weight: 700;
  color: var(--tp-grey-800);
  text-align: center;
}
.status.got {
  color: var(--tp-primary-700);
}
.note {
  text-align: center;
}
.acts {
  display: grid;
  gap: 10px;
  width: 100%;
  margin-top: 6px;
}
</style>
