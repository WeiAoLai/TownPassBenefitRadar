import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import './css/tokens.css'
import './css/base.css'

createApp(App).use(router).mount('#app')
