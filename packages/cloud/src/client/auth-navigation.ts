import type { CloudDiscovery } from '#cloud/contract'

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

export function cloudSignInURL(discovery: CloudDiscovery, returnURL: string): string {
  const destination = cloudEditorReturnURL(discovery, returnURL)
  const continuation = new URL('/auth/return', discovery.authURL)
  continuation.searchParams.set('editor', destination)
  const signIn = new URL('/auth/sign-in', discovery.authURL)
  signIn.searchParams.set('redirect', `${continuation.pathname}${continuation.search}`)
  return signIn.href
}
