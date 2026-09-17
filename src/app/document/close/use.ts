import { useEventListener } from '@vueuse/core'
import { onMounted, onScopeDispose } from 'vue'

import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'
import { allTabs, prepareForClose } from '@/app/tabs'
import { IS_TAURI } from '@/constants'

export function useDocumentCloseProtection() {
  let approved = false
  let closing = false
  let disposed = false
  const cleanup: Array<() => void> = []

  useEventListener(window, 'beforeunload', (event) => {
    if (approved || !allTabs.value.some((tab) => tab.isDirty)) return
    event.preventDefault()
    event.returnValue = ''
  })

  async function requestClose(close: () => Promise<void>) {
    if (closing) return
    closing = true
    try {
      if (!(await prepareForClose())) return
      approved = true
      await close()
    } catch (error) {
      approved = false
      toast.error(
        notificationMessages.get().operationFailed({
          error: error instanceof Error ? error.message : String(error)
        })
      )
    } finally {
      closing = false
    }
  }

  function registerCleanup(unsubscribe: () => void) {
    if (disposed) unsubscribe()
    else cleanup.push(unsubscribe)
  }

  onMounted(async () => {
    if (!IS_TAURI) return
    const [{ getCurrentWindow }, { listen }, { exit }] = await Promise.all([
      import('@tauri-apps/api/window'),
      import('@tauri-apps/api/event'),
      import('@tauri-apps/plugin-process')
    ])
    if (disposed) return
    const window = getCurrentWindow()
    await Promise.all([
      window
        .onCloseRequested((event) => {
          // Always intercept: Tauri destroys the window implicitly when a handler returns
          // without preventing, which would bypass the prompt after approval.
          event.preventDefault()
          if (approved) return
          void requestClose(() => window.destroy())
        })
        .then(registerCleanup),
      listen('app:request-exit', () => {
        void requestClose(() => exit(0))
      }).then(registerCleanup)
    ])
  })

  onScopeDispose(() => {
    disposed = true
    for (const unsubscribe of cleanup) unsubscribe()
  })
}
