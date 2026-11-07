import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import './css/tokens.css'
import './css/base.css'
import { initMotion } from './composables/motion'

initMotion()
createApp(App).use(router).mount('#app')
