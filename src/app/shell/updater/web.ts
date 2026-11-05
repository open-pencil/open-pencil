import { useDocumentVisibility, whenever } from '@vueuse/core'
import { watch } from 'vue'

import { updatesMessages } from '@open-pencil/vue/i18n'
import { useOpenOverlays } from '@open-pencil/vue/lifecycle/overlays'

import { confirmAppExit } from '@/app/document/close/exit'
import { toast } from '@/app/shell/ui'
import { allTabs } from '@/app/tabs'
import { IS_TAURI } from '@/constants'

export type WebUpdateOptions = {
  /** Takes the new version and reloads into it; a plain reload unless the worker supplies it. */
  reload?: () => void
  /** Asks about unsaved documents, as the desktop restart does. */
  confirm?: () => Promise<boolean>
  /** Whether any tab holds edits nothing else keeps. */
  hasUnkeptEdits?: () => boolean
  /** Whether a dialog, menu, or picker is open, which may hold a draft no tab counts. */
  overlayOpen?: () => boolean
  /** Whether nobody is looking at the page. */
  hidden?: () => boolean
}

/**
 * Offers the version the service worker just installed and keeps waiting, instead of reloading the
 * editor under the person using it. Reload asks about unsaved documents first, and the offer comes
 * back each time the page is shown again. A page in the background with nothing unsaved and nothing
 * open reloads on its own, so it is current when it comes back.
 */
export function offerWebUpdate(options: WebUpdateOptions = {}): void {
  const reload = options.reload ?? (() => window.location.reload())
  const confirm = options.confirm ?? confirmAppExit
  const hasUnkeptEdits = options.hasUnkeptEdits ?? (() => allTabs.value.some((tab) => tab.isDirty))
  const overlayOpen = options.overlayOpen ?? (() => false)
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

  function offer() {
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
  }

  offer()
  // A toast someone missed, or that newer ones pushed out, is offered again on their return.
  watch(hidden, (isHidden, wasHidden) => {
    if (wasHidden && !isHidden && !reloading) offer()
  })
  whenever(() => hidden() && !hasUnkeptEdits() && !overlayOpen(), reloadOnce, { immediate: true })
}

/**
 * Registers the web app's service worker, whose new versions wait for the person through
 * `offerWebUpdate`. Until they take one, the old worker keeps serving the old version's files, so
 * the page they are on can still load its own chunks. Called from the app's setup, where the open
 * overlays are known.
 */
export function useWebUpdates(): void {
  if (IS_TAURI) return
  const overlays = useOpenOverlays()
  void import('virtual:pwa-register').then(({ registerSW }) => {
    // Takes the waiting version and reloads once it is in control.
    const update = registerSW({
      immediate: true,
      onNeedRefresh: () =>
        offerWebUpdate({
          reload: () => void update(true),
          overlayOpen: () => overlays?.holdsKeys() ?? false
        })
    })
    return undefined
  })
}
