import type { CloudDiscovery } from '#cloud/contract'

/** Canonical web links come from the owning instance, never the caller's window. */
export function cloudShareURL(
  discovery: CloudDiscovery,
  serverURL: string,
  shareId: string,
  secret: string
): string {
  if (!discovery.appURL) throw new Error('This instance does not advertise a public editor URL')
  const url = new URL(discovery.appURL)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('The public editor URL must use HTTP or HTTPS')
  }
  url.pathname = `/cloud/share/${encodeURIComponent(shareId)}`
  url.search = ''
  url.searchParams.set('server', serverURL)
  url.hash = secret
  return url.href
}

/** The two kinds of Cloud link that carry a secret: invitations and documents shared by link. */
export type CloudLinkKind = 'invitations' | 'share'

/**
 * The desktop app's form of a Cloud link, `openpencil://cloud/<kind>/<id>?server=…#secret`, which
 * `desktop/src/deep_link.rs` validates before the editor sees it.
 */
export function cloudDesktopLinkURL(
  kind: CloudLinkKind,
  id: string,
  serverURL: string,
  secret: string
): string {
  const url = new URL(`openpencil://cloud/${kind}/${encodeURIComponent(id)}`)
  url.searchParams.set('server', serverURL)
  url.hash = secret
  return url.href
}

/** Accept only same-origin application paths for post-authentication navigation. */
export function cloudRedirectPath(value: unknown, fallback = '/app'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback
  const origin = 'https://redirect.invalid'
  const url = new URL(value, origin)
  if (url.origin !== origin) return fallback
  return `${url.pathname}${url.search}${url.hash}`
}
