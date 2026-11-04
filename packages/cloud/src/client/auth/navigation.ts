import { cloudServerOrigin, type CloudDiscovery } from '#cloud/contract'
import { withoutFragment, withQuery } from 'ufo'

import type { CloudSocialProvider } from './client'

/** The instance owns authentication; only its own editor may receive the return. */
export function cloudEditorReturnURL(discovery: CloudDiscovery, value: string): string {
  const destination = new URL(value)
  if (
    !['https:', 'http:'].includes(destination.protocol) ||
    destination.origin !== cloudServerOrigin(discovery) ||
    destination.username ||
    destination.password
  ) {
    throw new Error('Authentication return URL must belong to this instance editor')
  }
  return withoutFragment(destination.href)
}

/**
 * The server's sign-in page, coming back to `returnURL` on its editor afterwards. A `provider`
 * starts that provider's sign-in at once, while the server's pages still handle two-step sign-in
 * and approval before the return.
 */
export function cloudSignInURL(
  discovery: CloudDiscovery,
  returnURL: string,
  provider?: CloudSocialProvider
): string {
  const offered = provider && discovery.authentication.socialProviders.includes(provider)
  // The pages are at the server's root, whatever path the auth API has.
  return withQuery(new URL('/auth/sign-in', discovery.authURL).href, {
    redirect: withQuery('/auth/return', { editor: cloudEditorReturnURL(discovery, returnURL) }),
    provider: offered ? provider : undefined
  })
}

/** Accept only same-origin application paths for post-authentication navigation. */
export function cloudRedirectPath(value: unknown, fallback = '/app'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback
  const origin = 'https://redirect.invalid'
  const url = new URL(value, origin)
  if (url.origin !== origin) return fallback
  return `${url.pathname}${url.search}${url.hash}`
}
