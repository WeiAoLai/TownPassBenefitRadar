<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { townPassAge } from './bridge'
import { evaluate } from './engine/evaluate'
import { nextQuestion } from './engine/nextQuestion'
import { applyAnswer } from './engine/questions'
import { emptyHousehold, type Persona } from './engine/personas'
import type { FieldKey, Household } from './engine/types'
import StartScreen from './components/StartScreen.vue'
import FamilyStep from './components/FamilyStep.vue'
import AskStep from './components/AskStep.vue'
import ResultStep from './components/ResultStep.vue'

type Screen = 'start' | 'family' | 'ask' | 'result'

const screen = ref<Screen>('start')
const household = ref<Household>(emptyHousehold())
const skipped = ref<Set<FieldKey>>(new Set())
/** 上一題用：每次回答前的狀態 */
const history = ref<{ household: Household; skipped: Set<FieldKey> }[]>([])
const answered = ref(0)
const prefilledAge = ref<number | null>(null)
const demo = ref<Persona | null>(null)

const evaluation = computed(() => evaluate(household.value))
const currentKey = computed(() => nextQuestion(evaluation.value, skipped.value))

onMounted(async () => {
  prefilledAge.value = await townPassAge()
})

function top() {
  window.scrollTo({ top: 0 })
}

function startFresh() {
  demo.value = null
  household.value = emptyHousehold(prefilledAge.value)
  skipped.value = new Set()
  history.value = []
  answered.value = 0
  screen.value = 'family'
  top()
}

function startDemo(p: Persona) {
  demo.value = p
  household.value = p.household
  skipped.value = new Set()
  history.value = []
  answered.value = 0
  screen.value = 'result'
  top()
}

function familyDone(h: Household) {
  household.value = h
  screen.value = currentKey.value ? 'ask' : 'result'
  top()
}

function answer(key: FieldKey, value: unknown) {
  history.value.push({ household: household.value, skipped: new Set(skipped.value) })
  household.value = applyAnswer(household.value, key, value)
  answered.value += 1
  if (!currentKey.value) {
    screen.value = 'result'
    top()
  }
}

function skip(key: FieldKey) {
  history.value.push({ household: household.value, skipped: new Set(skipped.value) })
  skipped.value = new Set([...skipped.value, key])
  answered.value += 1
  if (!currentKey.value) {
    screen.value = 'result'
    top()
  }
}

function back() {
  const prev = history.value.pop()
  if (!prev) {
    screen.value = 'family'
    return
  }
  household.value = prev.household
  skipped.value = prev.skipped
  answered.value -= 1
  screen.value = 'ask'
}

function restart() {
  screen.value = 'start'
  top()
}
</script>

<template>
  <StartScreen v-if="screen === 'start'" @start="startFresh" @demo="startDemo" />
  <FamilyStep
    v-else-if="screen === 'family'"
    :household="household"
    @done="familyDone"
    @back="restart"
  />
  <AskStep
    v-else-if="screen === 'ask' && currentKey"
    :household="household"
    :evaluation="evaluation"
    :field="currentKey"
    :answered="answered"
    @answer="answer"
    @skip="skip"
    @back="back"
  />
  <ResultStep
    v-else
    :household="household"
    :evaluation="evaluation"
    :demo="demo"
    :answered="answered"
    @restart="restart"
    @back="history.length ? back() : restart()"
  />
</template>
