import { useDocumentVisibility, whenever } from '@vueuse/core'

import { updatesMessages } from '@open-pencil/vue/i18n'

import { confirmAppExit } from '@/app/document/close/exit'
import { toast } from '@/app/shell/ui'
import { allTabs } from '@/app/tabs'

export type WebUpdateOptions = {
  /** Loads the new version; the page's own reload unless a test stands in. */
  reload?: () => void
  /** Asks about unsaved documents, as the desktop restart does. */
  confirm?: () => Promise<boolean>
  /** Whether any tab holds edits nothing else keeps. */
  hasUnkeptEdits?: () => boolean
  /** Whether nobody is looking at the page. */
  hidden?: () => boolean
}

/**
 * Offers the version the service worker just installed, instead of reloading the editor under the
 * person using it. Reload asks about unsaved documents first; a page in the background with nothing
 * unsaved reloads on its own, so it is current when it comes back.
 */
export function offerWebUpdate(options: WebUpdateOptions = {}): void {
  const reload = options.reload ?? (() => window.location.reload())
  const confirm = options.confirm ?? confirmAppExit
  const hasUnkeptEdits = options.hasUnkeptEdits ?? (() => allTabs.value.some((tab) => tab.isDirty))
  const hidden =
    options.hidden ??
    (() => {
      const visibility = useDocumentVisibility()
      return () => visibility.value === 'hidden'
    })()
  let reloading = false
  const reloadOnce = () => {
    if (reloading) return
    reloading = true
    reload()
  }

  const messages = updatesMessages.get()
  toast.info(messages.webUpdateReady, {
    label: messages.reload,
    run: () => {
      void confirm().then((agreed) => {
        if (agreed) reloadOnce()
        return undefined
      })
    }
  })
  whenever(() => hidden() && !hasUnkeptEdits(), reloadOnce, { immediate: true })
}
