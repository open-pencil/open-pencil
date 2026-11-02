import { useSessionStorage } from '@vueuse/core'
import { withoutFragment } from 'ufo'
import { ref } from 'vue'

import { cloudSignInURL, type CloudSocialProvider } from '@open-pencil/cloud/client'
import { cloudServerOrigin, type CloudDiscovery } from '@open-pencil/cloud/contract'

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
  if (IS_TAURI) return 'device'
  return cloudServerOrigin(discovery) === globalThis.location.origin ? 'redirect' : 'device'
}

export type CloudSignInMethod = CloudSocialProvider | 'email'

function returnURL(): string {
  return withoutFragment(globalThis.location.href)
}

/**
 * Leaves for the server's sign-in pages, which handle two-step sign-in and approval too;
 * `takePendingCloudSignIn` picks the server up after the return.
 */
export function redirectToCloudSignIn(
  serverId: string,
  discovery: CloudDiscovery,
  options: {
    /** How to sign in; the pages offer every way when none is chosen. */
    method?: CloudSignInMethod
    /** Leaves this page out of history, as one that showed nothing yet. */
    replace?: boolean
  } = {}
): void {
  pendingSignIn.value = serverId
  const provider = options.method === 'email' ? undefined : options.method
  const url = cloudSignInURL(discovery, returnURL(), provider)
  if (options.replace) globalThis.location.replace(url)
  else globalThis.location.assign(url)
}

/** Whether this tab left, or is leaving, to sign in, and has yet to pick the server up again. */
export function leftForCloudSignIn(): boolean {
  return pendingSignIn.value !== null
}

/** The server this tab left to sign in to, once, after coming back. */
export function takePendingCloudSignIn(): string | null {
  const serverId = pendingSignIn.value
  pendingSignIn.value = null
  return serverId
}
