import { useSessionStorage } from '@vueuse/core'
import { ref } from 'vue'

import { cloudSignInURL, type CloudSocialProvider } from '@open-pencil/cloud/client'
import type { CloudDiscovery } from '@open-pencil/cloud/contract'

import { IS_BROWSER, IS_TAURI } from '@/constants'

/** The server this tab left to sign in to; per tab, so another tab's return is not taken. */
const pendingSignIn = IS_BROWSER
  ? useSessionStorage<string | null>('open-pencil:cloud-sign-in', null)
  : ref<string | null>(null)

/**
 * How this app signs in to a server. A server sends people back only to its own editor, so a
 * browser on that address leaves for the server's pages and comes back to this tab; anything
 * else — the desktop app, another editor address — approves a code instead.
 */
export function cloudSignInRoute(discovery: CloudDiscovery): 'redirect' | 'device' {
  if (IS_TAURI || !discovery.appURL) return 'device'
  return new URL(discovery.appURL).origin === globalThis.location.origin ? 'redirect' : 'device'
}

export type CloudSignInMethod = CloudSocialProvider | 'email'

function returnURL(): string {
  const url = new URL(globalThis.location.href)
  url.hash = ''
  return url.href
}

/**
 * Leaves for the server's sign-in pages, which handle two-step sign-in and approval too;
 * `takePendingCloudSignIn` picks the server up after the return.
 */
export function redirectToCloudSignIn(
  serverId: string,
  discovery: CloudDiscovery,
  method: CloudSignInMethod
): void {
  pendingSignIn.value = serverId
  const provider = method === 'email' ? undefined : method
  globalThis.location.assign(cloudSignInURL(discovery, returnURL(), provider))
}

/** The server this tab left to sign in to, once, after coming back. */
export function takePendingCloudSignIn(): string | null {
  const serverId = pendingSignIn.value
  pendingSignIn.value = null
  return serverId
}
