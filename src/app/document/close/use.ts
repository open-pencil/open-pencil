import { useEventListener } from '@vueuse/core'
import { onMounted, onScopeDispose } from 'vue'

import { confirmAppExit, isExitApproved } from '@/app/document/close/exit'
import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'
import { allTabs } from '@/app/tabs'
import { IS_TAURI } from '@/constants'

export function useDocumentCloseProtection() {
  let closing = false
  let disposed = false
  const cleanup: Array<() => void> = []

  useEventListener(window, 'beforeunload', (event) => {
    if (isExitApproved() || !allTabs.value.some((tab) => tab.isDirty)) return
    event.preventDefault()
    event.returnValue = ''
  })

  async function requestClose(close: () => Promise<void>) {
    if (closing) return
    closing = true
    try {
      if (!(await confirmAppExit())) return
      await close()
    } catch (error) {
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
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    if (disposed) return
    const window = getCurrentWindow()
    await window
      .onCloseRequested((event) => {
        // Always intercept: Tauri destroys the window implicitly when a handler returns
        // without preventing, which would bypass the prompt after approval.
        event.preventDefault()
        if (isExitApproved()) return
        void requestClose(() => window.destroy())
      })
      .then(registerCleanup)
  })

  onScopeDispose(() => {
    disposed = true
    for (const unsubscribe of cleanup) unsubscribe()
  })
}
