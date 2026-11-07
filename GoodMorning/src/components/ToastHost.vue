<script setup lang="ts">
import { dismiss, toasts } from '../composables/toast'
</script>

<template>
  <div class="host" role="status" aria-live="polite">
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
  min-height: 48px;
  padding: 12px 20px;
  border-radius: 8px;
  background: var(--tp-grey-800);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.2);
  text-align: center;
}
.toast.success {
  background: var(--tp-primary-700);
}
.toast.error {
  background: var(--tp-red-500);
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
