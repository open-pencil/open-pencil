import { createApp } from 'vue'

import './app.css'
import { preloadFonts } from '@/engine/fonts'
import { IS_TAURI } from '@/constants'

import App from './App.vue'
import router from './router'

preloadFonts()
createApp(App).use(router).mount('#app')

if (!IS_TAURI) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
  })
}
