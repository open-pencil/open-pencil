import { shallowRef } from 'vue'

import { IS_BROWSER, IS_TAURI } from '@open-pencil/core/constants'

/** Whether this browser lets the page show notifications; `unsupported` where it has none. */
export type BrowserNotificationPermission = NotificationPermission | 'unsupported'

function currentPermission(): BrowserNotificationPermission {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

/**
 * The page's notification permission. The desktop shell needs none, so it reads `granted`
 * there; whether the system shows them is up to its own settings, which the app cannot read.
 */
export const browserNotificationPermission = shallowRef<BrowserNotificationPermission>(
  IS_TAURI ? 'granted' : currentPermission()
)

if (IS_BROWSER && !IS_TAURI) {
  // Site settings can change the answer while the page is open; it is read again on return.
  window.addEventListener('focus', () => {
    browserNotificationPermission.value = currentPermission()
  })
}

/**
 * Asks the browser for permission. It must run from a click: Firefox and Safari refuse requests
 * that are not, and a refused request is not asked again.
 */
export async function requestBrowserNotificationPermission(): Promise<void> {
  if (typeof Notification === 'undefined') return
  browserNotificationPermission.value = await Notification.requestPermission()
}
