import { parseURL } from 'ufo'

import type { CloudAccessTokenAccess, CloudTokenScope } from '@open-pencil/cloud/contract'

/** Whether scopes let an app or token change documents, or only read them. */
export function scopeAccess(scopes: readonly CloudTokenScope[]): CloudAccessTokenAccess {
  return scopes.includes('documents:write') ? 'write' : 'read'
}

/**
 * The host of the address an app gave for itself, shown as text and never followed, or null when
 * it gave none or one without a host.
 */
export function appHost(uri: string | null): string | null {
  if (!uri) return null
  const { protocol, host } = parseURL(uri)
  return (protocol === 'https:' || protocol === 'http:') && host ? host : null
}
