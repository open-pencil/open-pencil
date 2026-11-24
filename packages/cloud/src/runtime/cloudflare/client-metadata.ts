import {
  // eslint-disable-next-line @open-pencil/structure/no-mixed-case-acronym-identifiers -- Upstream export spelling.
  validateClientIdUrl as validateClientIDURL
} from '@better-auth/cimd'
import type { ClientMetadataResourceFetch } from '@better-auth/oauth-provider'
import * as v from 'valibot'

/** Cloudflare's resolver over HTTPS, which a Worker reaches like any other address. */
const RESOLVER = 'https://cloudflare-dns.com/dns-query'

/** Record types whose answers are addresses: A and AAAA. */
const ADDRESS_TYPES = { A: 1, AAAA: 28 } as const

const answersSchema = v.object({
  Status: v.number(),
  Answer: v.optional(v.array(v.object({ type: v.number(), data: v.string() })), [])
})

async function addresses(
  hostname: string,
  type: keyof typeof ADDRESS_TYPES,
  signal?: AbortSignal | null
): Promise<string[]> {
  const url = new URL(RESOLVER)
  url.searchParams.set('name', hostname)
  url.searchParams.set('type', type)
  const response = await fetch(url, {
    headers: { accept: 'application/dns-json' },
    signal: signal ?? undefined
  })
  if (!response.ok) throw new Error(`Resolving ${hostname} failed with ${response.status}`)
  const answers = v.parse(answersSchema, await response.json())
  return answers.Answer.filter((answer) => answer.type === ADDRESS_TYPES[type]).map(
    (answer) => answer.data
  )
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
      addresses(url.hostname, 'A', init?.signal),
      addresses(url.hostname, 'AAAA', init?.signal)
    ])
  ).flat()
  if (found.length === 0 || !found.every(isPublic)) {
    throw new Error(`${url.hostname} does not resolve to public addresses alone`)
  }
  return fetch(url, { ...init, redirect: 'manual' })
}
