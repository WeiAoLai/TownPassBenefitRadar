<script setup lang="ts">
import { dismiss, liveMessage, toasts } from '../composables/toast'
</script>

<template>
  <div class="host" role="status" aria-live="polite">
    <!-- 看不見的播報文字（載入中等），讀報軟體會唸 -->
    <span class="visually-hidden">{{ liveMessage }}</span>
    <TransitionGroup name="toast">
      <button
        v-for="t in toasts"
        :key="t.id"
        type="button"
        class="toast"
        :class="t.kind"
        :role="t.kind === 'error' ? 'alert' : undefined"
        @click="dismiss(t.id)"
      >
        {{ t.text }}
        <span v-if="t.kind === 'error'" class="hint">點一下關閉</span>
      </button>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.host {
  position: fixed;
  left: 16px;
  right: 16px;
  top: calc(64px + env(safe-area-inset-top));
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  max-width: 560px;
  min-height: 56px;
  padding: 14px 20px;
  border-radius: 8px;
  background: var(--tp-grey-800);
  color: #fff;
  font-size: var(--tp-font-h3);
  line-height: var(--tp-lh-h3);
  font-weight: 700;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3);
  text-align: center;
}
.toast .hint {
  display: block;
  margin-top: 2px;
  font-size: var(--tp-font-body);
  font-weight: 400;
}
.toast.success {
  background: var(--tp-primary-700);
}
/* 深一階的紅：白字 5.64:1（red-500 只有 4.10） */
.toast.error {
  background: var(--c-danger-strong);
}
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
