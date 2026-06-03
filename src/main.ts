import { createHead } from '@unhead/vue/client'
import { createApp } from 'vue'

import './app.css'
import { preloadFonts } from '@/app/editor/fonts'
import { IS_TAURI } from '@/constants'

import App from './App.vue'
import router from './router'

preloadFonts()
const head = createHead()
createApp(App).use(router).use(head).mount('#app')

if (!IS_TAURI) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
  })

  // Restore the last opened document from IndexedDB so a reload does not
  // force the user to drag the file back in. We do this after mount + a
  // small delay so the editor / canvas are fully wired up before we feed
  // the cached file into openFileInNewTab.
  void (async () => {
    try {
      const [{ loadCachedPen, fileFromCachedPen }, tabsMod] = await Promise.all([
        import('@/app/document/io/pen-cache'),
        import('@/app/tabs')
      ])
      const cached = await loadCachedPen()
      if (!cached) return
      await tabsMod.openFileInNewTab(fileFromCachedPen(cached), undefined, undefined, {
        skipPersistCache: true
      })
    } catch (err) {
      console.warn('[main] failed to restore cached document:', err)
    }
  })()
}
