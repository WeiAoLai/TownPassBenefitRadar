<script setup lang="ts">
import { personas, type Persona } from '../engine/personas'

defineEmits<{ start: []; demo: [p: Persona] }>()
const list = personas()
</script>

<template>
  <main class="page stack">
    <header class="hero">
      <p class="kicker">拿不到的，不是錢，是資訊</p>
      <h1>領得到</h1>
      <p class="lead">
        不用先知道自己是不是低收入戶。告訴我們你跟誰住、去年報稅多少，
        我們幫你算出<strong>每個補助把誰算進你的家</strong>、能不能申請、大約能領多少。
      </p>
    </header>

    <button class="btn primary" @click="$emit('start')">開始試算（約 2 分鐘）</button>

    <section class="card privacy">
      <strong>不用身分證字號，也不會上傳。</strong>
      <span class="muted small">所有計算都在你的手機上完成，關掉頁面就消失。</span>
    </section>

    <section class="stack">
      <h2 class="h2">先看看別人的例子</h2>
      <button v-for="p in list" :key="p.id" class="persona card" @click="$emit('demo', p)">
        <strong>{{ p.title }}</strong>
        <span class="muted small">{{ p.story }}</span>
      </button>
    </section>

    <p class="muted small">
      目前涵蓋 11 項（臺北市 115 年度規則）：300 億中央擴大租金補貼、低收入戶、中低收入戶、
      中低收入老人生活津貼、身心障礙者生活補助、特殊境遇家庭子女生活津貼與緊急生活扶助、
      育兒津貼、臺北市生育補助、敬老卡與愛心卡、國民年金老年基本保證年金。
      試算僅供參考，以主管機關審核為準。
    </p>
  </main>
</template>

<style scoped>
.hero {
  padding: 12px 2px 4px;
}
.kicker {
  margin: 0;
  color: var(--accent);
  font-weight: 700;
  font-size: 0.9rem;
}
h1 {
  font-size: 2.4rem;
  letter-spacing: 0.04em;
}
.lead {
  margin: 8px 0 0;
  color: var(--text-2);
}
.lead strong {
  color: var(--text);
}
.privacy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--accent-soft);
  border-color: transparent;
  box-shadow: none;
}
.h2 {
  font-size: 1.1rem;
}
.persona {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  text-align: left;
  min-height: 56px;
}
</style>
