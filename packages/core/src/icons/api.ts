import { uniq } from 'es-toolkit'
import { createFetch } from 'ofetch'
import * as v from 'valibot'

import { CollectionListJSON, CollectionsJSON } from './schema'
import type { IconCollection, IconifyResponse, IconSearchResult } from './types'

const ICONIFY_API = 'https://api.iconify.design'
const FETCH_TIMEOUT_MS = 10_000

export function createIconifyAPIClient(
  fetcher: typeof globalThis.fetch = globalThis.fetch,
  baseURL = ICONIFY_API
) {
  const iconifyAPI = createFetch({ fetch: fetcher }).create({
    baseURL,
    retry: 0,
    timeout: FETCH_TIMEOUT_MS
  })

  /** A response body as text, so callers validate what the API sent rather than trust it. */
  async function text(path: string, query?: Record<string, string>): Promise<string> {
    const response = await iconifyAPI.raw<string, 'text'>(path, {
      ignoreResponseError: true,
      responseType: 'text',
      query
    })
    if (!response.ok) throw new Error(`Iconify API error: ${response.status} for ${path}`)
    return response._data ?? ''
  }

  return {
    async fetchCollection(prefix: string, iconNames: string[]): Promise<IconifyResponse> {
      const response = await iconifyAPI.raw<IconifyResponse>(`/${prefix}.json`, {
        ignoreResponseError: true,
        query: { icons: iconNames.join(',') }
      })
      if (!response.ok) {
        throw new Error(`Iconify API error: ${response.status} for prefix "${prefix}"`)
      }
      return response._data as IconifyResponse
    },

    /** Every icon set the API serves, retired ones left out. */
    async collections(): Promise<IconCollection[]> {
      const parsed = v.safeParse(CollectionsJSON, await text('/collections'))
      if (!parsed.success) throw new Error('Iconify API returned an unexpected set list')
      return Object.entries(parsed.output)
        .filter(([, info]) => !info.hidden)
        .map(([prefix, info]) => ({
          prefix,
          name: info.name,
          total: info.total,
          category: info.category ?? null,
          license: info.license?.title ?? null,
          multicolor: info.palette === true
        }))
    },

    /** Every icon in the set `prefix`, as `prefix:name`, in the set's own order. */
    async collectionIcons(prefix: string): Promise<string[]> {
      const parsed = v.safeParse(CollectionListJSON, await text('/collection', { prefix }))
      if (!parsed.success)
        throw new Error(`Iconify API returned an unexpected list for "${prefix}"`)
      const { uncategorized = [], categories = {} } = parsed.output
      const names = uniq([...uncategorized, ...Object.values(categories).flat()])
      return names.map((name) => `${prefix}:${name}`)
    },

    async search(
      query: string,
      options?: { limit?: number; prefix?: string }
    ): Promise<IconSearchResult> {
      const response = await iconifyAPI.raw<IconSearchResult>('/search', {
        ignoreResponseError: true,
        query: { query, limit: options?.limit, prefix: options?.prefix }
      })
      if (!response.ok) throw new Error(`Iconify search error: ${response.status}`)

      const data = response._data
      const limit = options?.limit ?? 5
      return {
        icons: data?.icons.slice(0, limit) ?? [],
        total: data?.total ?? 0,
        collections: data?.collections ?? {}
      }
    }
  }
}
