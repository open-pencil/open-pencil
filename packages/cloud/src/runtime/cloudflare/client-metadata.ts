import dns from 'node:dns/promises'
import { isIP } from 'node:net'

import {
  // eslint-disable-next-line @open-pencil/structure/no-mixed-case-acronym-identifiers -- Upstream export spelling.
  validateClientIdUrl as validateClientIDURL
} from '@better-auth/cimd'
import type { ClientMetadataResourceFetch } from '@better-auth/oauth-provider'

/** What `node:dns` answers for a name with no records of the type asked for. */
const NO_RECORDS = new Set(['ENODATA', 'ENOTFOUND'])

/**
 * The host's addresses of one family, through the Workers runtime's DNS over HTTPS, which also
 * answers with the names a CNAME points to.
 */
async function addresses(resolve: (hostname: string) => Promise<string[]>, hostname: string) {
  try {
    return (await resolve(hostname)).filter((answer) => isIP(answer) !== 0)
  } catch (error) {
    if (error instanceof Error && 'code' in error && NO_RECORDS.has(String(error.code))) return []
    throw error
  }
}

/** Whether an address is one the CIMD plugin takes for a public host. */
function isPublic(address: string): boolean {
  const host = address.includes(':') ? `[${address}]` : address
  return validateClientIDURL(`https://${host}/`) === null
}

/**
 * How a Worker fetches an app's client metadata document. The plugin asks its transport to
 * resolve a host once, refuse any address that is not public, and connect to the address it
 * checked; a Worker cannot pin the address its `fetch` connects to, so this resolves the host and
 * refuses it when any address is not public, then fetches it by name without following
 * redirects. A Worker's `fetch` refuses IP literals and reaches private networks only through a
 * VPC binding, so a host that changes its answer between the two lookups is left the public
 * internet to point at.
 */
export const fetchClientMetadataOnCloudflare: ClientMetadataResourceFetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input)
  const found = (
    await Promise.all([
      addresses((name) => dns.resolve4(name), url.hostname),
      addresses((name) => dns.resolve6(name), url.hostname)
    ])
  ).flat()
  if (found.length === 0 || !found.every(isPublic)) {
    throw new Error(`${url.hostname} does not resolve to public addresses alone`)
  }
  return fetch(url, { ...init, redirect: 'manual' })
}
