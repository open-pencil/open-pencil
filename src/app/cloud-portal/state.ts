import { noop, useAsyncState } from '@vueuse/core'
import { computed, getCurrentInstance, onActivated, shallowRef } from 'vue'

import { usePortalFailureMessages } from './failure'

/**
 * Where a load stands: nothing to show yet, the last value shown while a newer one loads, or done.
 * A failure is `failed` before anything loaded and `ready` with an error after, since the page
 * then still has something to show.
 */
export type PortalLoadStatus = 'loading' | 'failed' | 'refreshing' | 'ready'

/**
 * Something the page reads from the server. A newer load replaces an older one still running,
 * a failure is kept in words until the next load starts, and the last good value stays shown.
 * A page the console keeps alive loads again when it comes back, showing what it had meanwhile.
 */
export function usePortalLoad<T>(load: () => Promise<T>, initial: T) {
  const failures = usePortalFailureMessages()
  // `useAsyncState` resets its own `isReady` on every run, so whether anything ever loaded is kept
  // here: it tells a first load, with nothing to show, from a refresh. Only the newest request
  // counts, as for the value: an older one that succeeds after a newer one failed shows nothing.
  const loaded = shallowRef(false)
  let latest = 0
  const { state, isLoading, error, execute } = useAsyncState(
    async () => {
      const request = ++latest
      const value = await load()
      if (request === latest) loaded.value = true
      return value
    },
    initial,
    { resetOnExecute: false, onError: noop }
  )
  const status = computed<PortalLoadStatus>(() => {
    if (loaded.value) return isLoading.value ? 'refreshing' : 'ready'
    return isLoading.value ? 'loading' : 'failed'
  })
  // `onActivated` also runs when the page first appears, which has just started its own load.
  let shown = false
  if (getCurrentInstance()) {
    onActivated(() => {
      if (shown) void execute()
      shown = true
    })
  }
  return {
    data: state,
    loading: isLoading,
    status,
    error: computed(() => (error.value === undefined ? null : failures.api(error.value))),
    reload: async () => {
      await execute()
    }
  }
}

/**
 * A change the page makes. `busy` is true while it runs and `subject` names what it runs on, its
 * first argument; a thrown failure is put in words, and `fail` reports one the change found itself.
 * Each run clears the previous failure, and so does `clear`. `abandon` lets go of a run still
 * under way, as when the person leaves the page: it is no longer busy, and its failure is not
 * reported; a later run is reported as usual.
 */
export function usePortalAction<Args extends unknown[]>(
  action: (...args: Args) => Promise<unknown>
) {
  const failures = usePortalFailureMessages()
  const subject = shallowRef<Args[0] | null>(null)
  const reported = shallowRef<string | null>(null)
  const abandoned = shallowRef(false)
  const { isLoading, error, execute } = useAsyncState(
    (...args: Args) => {
      subject.value = args[0] ?? null
      reported.value = null
      abandoned.value = false
      return action(...args)
    },
    undefined,
    { immediate: false, onError: noop }
  )
  const busy = computed(() => isLoading.value && !abandoned.value)
  return {
    busy,
    subject: computed(() => (busy.value ? subject.value : null)),
    error: computed(() => {
      if (abandoned.value) return null
      return reported.value ?? (error.value === undefined ? null : failures.api(error.value))
    }),
    run: async (...args: Args) => {
      await execute(0, ...args)
    },
    fail(message: string) {
      reported.value = message
    },
    clear() {
      reported.value = null
      error.value = undefined
    },
    abandon() {
      abandoned.value = true
    }
  }
}
