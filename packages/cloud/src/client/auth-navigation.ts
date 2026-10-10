import type { CloudDiscovery } from '#cloud/contract'

import type { CloudSocialProvider } from './auth'

/** The instance owns authentication; only its configured editor may receive the return. */
export function cloudEditorReturnURL(discovery: CloudDiscovery, value: string): string {
  if (!discovery.appURL) throw new Error('This instance does not advertise a public editor URL')
  const editor = new URL(discovery.appURL)
  const destination = new URL(value)
  if (
    !['https:', 'http:'].includes(editor.protocol) ||
    destination.origin !== editor.origin ||
    destination.username ||
    destination.password
  ) {
    throw new Error('Authentication return URL must belong to this instance editor')
  }
  destination.hash = ''
  return destination.href
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
  const destination = cloudEditorReturnURL(discovery, returnURL)
  const continuation = new URL('/auth/return', discovery.authURL)
  continuation.searchParams.set('editor', destination)
  const signIn = new URL('/auth/sign-in', discovery.authURL)
  signIn.searchParams.set('redirect', `${continuation.pathname}${continuation.search}`)
  if (provider && discovery.authentication.socialProviders.includes(provider)) {
    signIn.searchParams.set('provider', provider)
  }
  return signIn.href
}
