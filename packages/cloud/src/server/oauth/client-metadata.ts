import type { CloudDatabase } from '#cloud/server/db'
import {
  CLOUD_RATE_LIMITS,
  PostgresRateLimitStore,
  type SiteRateLimitPolicy
} from '#cloud/server/rate-limit'
import {
  // eslint-disable-next-line @open-pencil/structure/no-mixed-case-acronym-identifiers -- Upstream export spelling.
  createCimdClientDiscovery as createCIMDClientDiscovery
} from '@better-auth/cimd'
import type { ClientDiscovery, ClientMetadataResourceFetch } from '@better-auth/oauth-provider'
import { APIError } from 'better-auth'
import type { Kysely } from 'kysely'

import { HOUR_MS, MINUTE_MS, SECOND_MS } from '@open-pencil/std/timing'

/** How long an app's stored document stands before it is fetched again, whatever its headers say. */
const FRESH_MS = 5 * MINUTE_MS
/** How long the plugin keeps a document itself, within one instance. */
const PLUGIN_CACHE_SECONDS = (4 * MINUTE_MS) / SECOND_MS
/** How long past its last fetch a known app still connects while the fetch budget is spent. */
const STALE_MS = 24 * HOUR_MS

type ClientMetadataOptions = {
  database: Kysely<CloudDatabase>
  secret: string
  fetchClientMetadata: ClientMetadataResourceFetch
}

/** Counts fetches of one kind across every process and Worker isolate, per site and overall. */
function createFetchBudget(
  { database, secret }: ClientMetadataOptions,
  policy: SiteRateLimitPolicy
) {
  const store = new PostgresRateLimitStore(database, secret, policy.namespace, {
    windowMs: policy.windowMs
  })
  return async (url: string): Promise<boolean> => {
    // The site first, so one over its own budget leaves the shared one alone.
    const site = await store.increment(`site:${new URL(url).origin}`)
    if (site.totalHits > policy.siteLimit) return false
    return (await store.increment('all')).totalHits <= policy.limit
  }
}

/**
 * Lets apps name the address of a metadata document they serve as their client ID instead of
 * registering, as MCP clients do (draft-ietf-oauth-client-id-metadata-document, MCP 2026-07-28).
 *
 * The plugin keeps its cache and fetch budgets in its instance, which a Worker makes for each
 * request, so both live in the database here: a client's `updatedAt` is when its document was last
 * fetched and valid, and fetches are counted there.
 */
export function cloudClientDiscovery(options: ClientMetadataOptions): ClientDiscovery {
  const discovery = createCIMDClientDiscovery({
    fetchClientMetadataResource: options.fetchClientMetadata,
    // Expired by the time the stored client is, so every counted fetch is made and dates the client.
    metadataRevalidationInterval: PLUGIN_CACHE_SECONDS,
    metadataProfile: 'mcp-2026-07-28'
  })
  const mayFetchDocument = createFetchBudget(options, CLOUD_RATE_LIMITS.clientMetadata)
  const mayFetchKeys = createFetchBudget(options, CLOUD_RATE_LIMITS.clientKeys)
  return {
    ...discovery,
    async resolve(context, clientId, existing) {
      const age = existing?.updatedAt
        ? Date.now() - new Date(existing.updatedAt).getTime()
        : Number.POSITIVE_INFINITY
      if (existing && age < FRESH_MS) return existing
      if (!(await mayFetchDocument(clientId))) {
        if (existing && age < STALE_MS) return existing
        throw new APIError('TOO_MANY_REQUESTS', {
          error: 'temporarily_unavailable',
          error_description:
            'Too many client metadata documents were fetched. Try again in a minute.'
        })
      }
      return discovery.resolve(context, clientId, existing)
    },
    // The plugin fetches an app's `jwks_uri` through this, outside its own budgets.
    async fetchClientMetadataResource(input, init) {
      const url = input instanceof Request ? input.url : input.toString()
      if (!(await mayFetchKeys(url))) throw new Error('The client key fetch budget is spent')
      return options.fetchClientMetadata(input, init)
    }
  }
}
