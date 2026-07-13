import { createFetch } from 'ofetch'

import type { IconifyResponse, IconSearchResult } from './types'

const ICONIFY_API = 'https://api.iconify.design'
const FETCH_TIMEOUT_MS = 10_000

export function createIconifyAPIClient(
  fetcher: typeof globalThis.fetch = globalThis.fetch,
  baseURL = ICONIFY_API
) {
  const iconifyApi = createFetch({ fetch: fetcher }).create({
    baseURL,
    retry: 0,
    timeout: FETCH_TIMEOUT_MS
  })

  return {
    async fetchCollection(prefix: string, iconNames: string[]): Promise<IconifyResponse> {
      const response = await iconifyApi.raw<IconifyResponse>(`/${prefix}.json`, {
        ignoreResponseError: true,
        query: { icons: iconNames.join(',') }
      })
      if (!response.ok) {
        throw new Error(`Iconify API error: ${response.status} for prefix "${prefix}"`)
      }
      return response._data as IconifyResponse
    },

    async search(
      query: string,
      options?: { limit?: number; prefix?: string }
    ): Promise<IconSearchResult> {
      const response = await iconifyApi.raw<IconSearchResult>('/search', {
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

const iconifyAPIClient = createIconifyAPIClient()

export function fetchIconifyCollection(
  prefix: string,
  iconNames: string[]
): Promise<IconifyResponse> {
  return iconifyAPIClient.fetchCollection(prefix, iconNames)
}

export function searchIconify(
  query: string,
  options?: { limit?: number; prefix?: string }
): Promise<IconSearchResult> {
  return iconifyAPIClient.search(query, options)
}
