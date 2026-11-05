import { useDocumentVisibility, useEventListener, useIntervalFn, whenever } from '@vueuse/core'
import { watch } from 'vue'

import { updatesMessages } from '@open-pencil/vue/i18n'
import { useOpenOverlays } from '@open-pencil/vue/lifecycle/overlays'

import { confirmAppExit } from '@/app/document/close/exit'
import { toast } from '@/app/shell/ui'
import { allTabs } from '@/app/tabs'
import { IS_TAURI } from '@/constants'

/** How often an open page asks for a new version, besides each time it is shown again. */
const WEB_UPDATE_CHECK_MS = 60 * 60 * 1000

/** Whether nobody is looking at the page. */
function useDocumentHidden(): () => boolean {
  const visibility = useDocumentVisibility()
  return () => visibility.value === 'hidden'
}

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
  const hidden = options.hidden ?? useDocumentHidden()
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
        // A dialog's draft is no document, so nothing would ask about it: it is closed first.
        if (overlayOpen()) return
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
 * Asks for a new version every hour and whenever the page is shown again. The browser itself checks
 * only when a page loads, and the editor can stay open for days without loading another.
 */
export function watchForWebUpdates(check: () => void, hidden: () => boolean = useDocumentHidden()) {
  // Started by hand: VueUse starts it on its own only where it finds a window.
  useIntervalFn(check, WEB_UPDATE_CHECK_MS, { immediate: false }).resume()
  watch(hidden, (isHidden, wasHidden) => {
    if (wasHidden && !isHidden) check()
  })
}

/** A service worker registration, as far as `watchInstalledVersions` needs it. */
export type InstallingRegistration = EventTarget & {
  readonly installing: (EventTarget & { readonly state: ServiceWorkerState }) | null
}

/**
 * Calls `onInstalled` each time a new version finishes installing. Workbox stops listening for
 * updates after the first one it finds a minute or more after registering, so a version that
 * installs after another failed would otherwise never be offered.
 */
export function watchInstalledVersions(
  registration: InstallingRegistration,
  onInstalled: () => void
): void {
  useEventListener(registration, 'updatefound', () => {
    const { installing } = registration
    if (!installing) return
    useEventListener(installing, 'statechange', () => {
      if (installing.state === 'installed') onInstalled()
    })
  })
}

/** The service worker's side of taking a new version, which `takeWebUpdate` drives. */
export type WaitingUpdate = {
  /** Whether another tab already took the new version, which now controls this page too. */
  takenElsewhere: boolean
  /** Whether a service worker controls this page, as `navigator.serviceWorker.controller` says. */
  controlled: boolean
  /** The installed version waiting to take over, if any. */
  waiting: (EventTarget & { readonly state: ServiceWorkerState }) | null
  /** Asks the waiting version to take over, reloading a controlled page once it does. */
  activate: () => void
  reload: () => void
}

/**
 * Has the new version take over and reloads into it. A page whose worker another tab already
 * replaced just reloads. The service worker's switch reloads a page it already controlled; a page
 * loaded before any worker controlled it, such as on a first visit, reloads here once the new
 * version is active, or at once when none is left waiting.
 */
export function takeWebUpdate(update: WaitingUpdate): void {
  const { waiting } = update
  if (update.takenElsewhere) {
    update.reload()
  } else if (update.controlled) {
    update.activate()
  } else if (!waiting) {
    update.reload()
  } else {
    useEventListener(waiting, 'statechange', () => {
      if (waiting.state === 'activated') update.reload()
    })
    update.activate()
  }
}

/**
 * Registers the web app's service worker, whose new versions wait for the person through
 * `offerWebUpdate`. Until they take one, the old worker keeps serving the old version's files, so
 * the page they are on can still load its own chunks. Called from the app's setup, where the open
 * overlays are known.
 */
export function useWebUpdates(): void {
  // Plain HTTP away from localhost has no service workers, as some browsers do not.
  if (IS_TAURI || !('serviceWorker' in navigator)) return
  const overlays = useOpenOverlays()
  // A first visit's worker taking control of the page is no new version.
  const controlledAtStart = navigator.serviceWorker.controller !== null
  // Imported when called: tests load this module, and only Vite supplies the plugin's modules.
  void import('virtual:pwa-register/vue').then(({ useRegisterSW }) => {
    let taking = false
    let takenElsewhere = false
    // The plugin's own reload is left out (`onNeedReload`): it would reload every tab.
    const { needRefresh, updateServiceWorker } = useRegisterSW({ onNeedReload: () => undefined })
    // The first worker to install on a page no worker controls is no new version.
    void navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration)
        watchInstalledVersions(registration, () => {
          if (navigator.serviceWorker.controller) needRefresh.value = true
        })
      return undefined
    })
    // Offline, or with the server unreachable, the next check tries again.
    watchForWebUpdates(
      () =>
        void navigator.serviceWorker
          .getRegistration()
          .then((registration) => registration?.update())
          .catch(() => undefined)
    )
    // Taking the new version switches every open tab to it. Only the tab that took it reloads at
    // once; another tab keeps, or now gets, the offer, which reloads when it will not lose
    // anything, even when the switch reached it before the plugin reported the version.
    useEventListener(navigator.serviceWorker, 'controllerchange', () => {
      if (taking) {
        window.location.reload()
      } else if (controlledAtStart) {
        takenElsewhere = true
        needRefresh.value = true
      }
    })
    whenever(
      needRefresh,
      () =>
        offerWebUpdate({
          // Workbox reports a version already waiting before `onRegisteredSW` runs, so the
          // registration is looked up when the update is taken rather than kept from that callback.
          reload: () =>
            void navigator.serviceWorker.getRegistration().then((registration) => {
              taking = true
              takeWebUpdate({
                takenElsewhere,
                controlled: navigator.serviceWorker.controller !== null,
                waiting: registration?.waiting ?? null,
                activate: () => void updateServiceWorker(true),
                reload: () => window.location.reload()
              })
              return undefined
            }),
          overlayOpen: () => overlays?.holdsKeys() ?? false
        }),
      { once: true }
    )
    return undefined
  })
}
