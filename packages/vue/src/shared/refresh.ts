import { useEventListener, useIntervalFn } from '@vueuse/core'

import { IS_BROWSER } from '@open-pencil/core/constants'

export type UseAutoRefreshOptions = {
  /** How often to refresh while the page is visible, in milliseconds; off when absent or 0. */
  interval?: number
  /** Refresh when the window regains focus. Default true. */
  onFocus?: boolean
  /** Refresh when the browser comes back online. Default true. */
  onReconnect?: boolean
}

/**
 * Keeps something read from elsewhere current: refreshes when the window regains focus, when the
 * browser comes back online, and on an interval while the page is visible. One refresh runs at a
 * time; asking again while one runs refreshes once more after it, so a change made meanwhile is
 * not missed.
 */
export function useAutoRefresh(run: () => Promise<unknown>, options: UseAutoRefreshOptions = {}) {
  let running: Promise<void> | null = null
  let queued = false

  /** Refreshes now, or joins the refresh under way. */
  function refresh(): Promise<void> {
    if (running) return running
    const next = run()
      .then(() => undefined)
      .finally(() => {
        running = null
        if (queued) {
          queued = false
          void refresh()
        }
      })
    running = next
    return next
  }

  /** Refreshes now, or once more after the refresh under way, which may have read too early. */
  function invalidate(): Promise<void> {
    if (!running) return refresh()
    queued = true
    return running
  }

  if (options.onFocus !== false && IS_BROWSER) {
    useEventListener(window, 'focus', () => void invalidate())
  }
  if (options.onReconnect !== false && IS_BROWSER) {
    useEventListener(window, 'online', () => void invalidate())
  }
  if (options.interval && options.interval > 0) {
    useIntervalFn(
      () => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
          void invalidate()
        }
      },
      options.interval,
      { immediate: true, immediateCallback: false }
    )
  }

  /** Stops a queued refresh from starting, as when the owner goes away. */
  function cancelQueued() {
    queued = false
  }

  return { refresh, invalidate, cancelQueued }
}
