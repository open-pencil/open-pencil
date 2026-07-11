import { createHead } from '@unhead/vue/client'
import { createApp } from 'vue'

import './app.css'
import { preloadFonts } from '@/app/editor/fonts'
import { IS_TAURI } from '@/constants'

import App from './App.vue'
import router from './router'

preloadFonts()
const head = createHead()
const app = createApp(App)
app.use(router).use(head).mount('#app')

// Safety: if we never open an editor canvas (e.g. cloud Files home), still clear the boot loader.
void router
  .isReady()
  .then(async () => {
    const { fadeOutGlobalLoader } = await import('@/app/editor/canvas/loader-overlay')
    const name = router.currentRoute.value.name
    if (name === 'home' || name === undefined) {
      // Give Vue one tick to paint HomeView, then ensure the HTML boot loader is gone.
      requestAnimationFrame(() => fadeOutGlobalLoader())
    }
    return undefined
  })
  .catch((error: unknown) => {
    console.warn('[Boot] loader fade-out failed:', error)
    document.getElementById('loader')?.remove()
  })

if (!IS_TAURI) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
    return undefined
  })
}
