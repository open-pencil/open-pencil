import { createHead } from '@unhead/vue/client'
import { createApp, nextTick } from 'vue'

import { setIdSession } from '@open-pencil/scene-graph'
import { randomInt } from '@open-pencil/scene-graph/random'
import { createRetainedScopePlugin } from '@open-pencil/vue'

import './app.css'
import { recordRuntimeError } from '@/app/diagnostics'
import { preloadFonts } from '@/app/editor/fonts'
import { observeBootErrors } from '@/app/shell/support/boot'
import { reportBootFailure } from '@/app/shell/support/gate'
import { IS_TAURI } from '@/constants'

import App from './App.vue'
import router from './router'

/**
 * Application entry, loaded by `main.ts` only after the support gate passes.
 * Keeping it behind a dynamic import means an unsupported engine never
 * evaluates the app bundle and can still show the gate's guidance.
 */
export async function boot(): Promise<void> {
  // A session of its own, so layers this window creates never share IDs with a collaborator's.
  setIdSession(randomInt() >>> 0)
  preloadFonts()
  const head = createHead()
  const app = createApp(App)
  const bootErrors = observeBootErrors(app)
  app.use(router).use(head).use(createRetainedScopePlugin()).mount('#app')

  await router.isReady()
  await nextTick()
  const failure = bootErrors.stop()
  if (failure) {
    await reportBootFailure(failure.error)
    return
  }
  // Component errors after boot reach only this handler, not the window; keep them diagnosable.
  app.config.errorHandler = (error, _instance, info) => {
    recordRuntimeError(error, 'vue', info)
    console.error(error)
  }

  if (!IS_TAURI) {
    void import('virtual:pwa-register').then(({ registerSW }) => {
      registerSW({ immediate: true })
      return undefined
    })
  }
}
