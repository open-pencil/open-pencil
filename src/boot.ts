import { createHead } from '@unhead/vue/client'
import { createApp, nextTick } from 'vue'

import { ReadOnlyDocumentError } from '@open-pencil/core'
import { diagnosticsMessages } from '@open-pencil/vue/i18n'
import { createRetainedScopePlugin } from '@open-pencil/vue/lifecycle/retention'

import './app.css'
import { recordRuntimeError } from '@/app/diagnostics'
import { installNativeFigArchives } from '@/app/document/io/native-fig'
import { preloadCanvasKit } from '@/app/editor/canvas/canvaskit'
import { preloadFonts } from '@/app/editor/fonts'
import { registerInterfaceFont } from '@/app/editor/fonts/interface'
import { reportErrorAction } from '@/app/reports/state'
import { observeBootErrors } from '@/app/shell/support/boot'
import { reportBootFailure } from '@/app/shell/support/gate'
import { toast } from '@/app/shell/ui'
import { IS_TAURI } from '@/constants'

import App from './App.vue'
import router from './router'

/**
 * Application entry, loaded by `main.ts` only after the support gate passes.
 * Keeping it behind a dynamic import means an unsupported engine never
 * evaluates the app bundle and can still show the gate's guidance.
 */
export async function boot(): Promise<void> {
  registerInterfaceFont()
  if (IS_TAURI) installNativeFigArchives()
  preloadCanvasKit()
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
    // A panel's edit to a read-only document does nothing, as in Figma.
    if (error instanceof ReadOnlyDocumentError) return
    recordRuntimeError(error, 'vue', info)
    console.error(error)
    // Official builds offer to report it; others keep it in the console and the diagnostics log.
    const report = reportErrorAction(error, 'vue')
    if (report) toast.error(diagnosticsMessages.get().reportUnexpectedError, report)
  }

  if (!IS_TAURI) {
    void import('virtual:pwa-register').then(({ registerSW }) => {
      registerSW({ immediate: true })
      return undefined
    })
  }
}
