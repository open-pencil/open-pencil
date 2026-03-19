import { createHead } from '@unhead/vue/client'
import { createApp } from 'vue'

import './app.css'
import { IS_TAURI } from '@/constants'
import { preloadFonts } from '@/engine/fonts'
import { i18n } from '@/i18n'

import App from './App.vue'
import router from './router'

preloadFonts()
const head = createHead()
createApp(App).use(router).use(head).use(i18n).mount('#app')

if (!IS_TAURI) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
  })
}
