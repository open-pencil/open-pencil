import { useEventListener } from '@vueuse/core'

import { backupIsActive } from '@/app/storage/backup'
import { pendingSyncCount } from '@/app/storage/sync/status'

/**
 * Whether closing now would leave work that was meant to be in the cloud only
 * on this device.
 *
 * Deliberately narrow. Local-only and paused are supported ways to work, and
 * documents are already durable in IndexedDB before anything is queued — so the
 * risk is not "you will lose this", it is "this will not be where you expect it
 * if you next open the app somewhere else". Warning when nothing was ever meant
 * to upload would be nagging about a configuration the user chose.
 */
export function hasUnsyncedCloudWork(): boolean {
  return backupIsActive() && pendingSyncCount.value > 0
}

/**
 * Ask the browser to confirm before closing with uploads outstanding.
 *
 * The text is not ours to write: browsers ignore any custom message and show
 * their own generic prompt, so this only decides WHETHER to interrupt. That
 * makes restraint the whole design — an interruption we cannot word is one we
 * should raise only when it is genuinely warranted.
 */
export function useUnsyncedCloseWarning(): void {
  useEventListener(window, 'beforeunload', (event: BeforeUnloadEvent) => {
    if (!hasUnsyncedCloudWork()) return
    event.preventDefault()
    // Safari and older Chrome still require a truthy `returnValue` to prompt.
    event.returnValue = true
  })
}
