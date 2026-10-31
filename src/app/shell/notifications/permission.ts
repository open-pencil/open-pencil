import { usePermission } from '@vueuse/core'
import { readonly, shallowRef, watch } from 'vue'

import { IS_TAURI } from '@open-pencil/core/constants'

/** Whether this browser lets the page show notifications; `unsupported` where it has none. */
export type BrowserNotificationPermission = NotificationPermission | 'unsupported'

function current(): BrowserNotificationPermission {
  // The desktop shell needs no permission; whether the system shows notifications is up to its
  // own settings, which the app cannot read.
  if (IS_TAURI) return 'granted'
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

const permission = shallowRef(current())
// The person can change the site setting while the page is open.
watch(usePermission('notifications'), () => {
  permission.value = current()
})

/** The page's notification permission, kept current as the site setting changes. */
export const browserNotificationPermission = readonly(permission)

/**
 * Asks the browser for permission. It must run from a click: Firefox and Safari refuse requests
 * that are not, and a refused request is not asked again.
 */
export async function requestBrowserNotificationPermission(): Promise<void> {
  if (typeof Notification === 'undefined') return
  permission.value = await Notification.requestPermission()
}
