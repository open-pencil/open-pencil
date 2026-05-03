import type { IconifyResponse, IconSearchResult } from './types'

const ICONIFY_API = 'https://api.iconify.design'
const FETCH_TIMEOUT_MS = 10_000

function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
}

export async function fetchIconifyCollection(
  prefix: string,
  iconNames: string[]
): Promise<IconifyResponse> {
  const url = `${ICONIFY_API}/${prefix}.json?icons=${iconNames.map(encodeURIComponent).join(',')}`
  const response = await fetchWithTimeout(url)
  if (!response.ok) throw new Error(`Iconify API error: ${response.status} for prefix "${prefix}"`)
  return (await response.json()) as IconifyResponse
}

export async function searchIconify(
  query: string,
  options?: {
    limit?: number
    prefix?: string
  }
): Promise<IconSearchResult> {
  const params = new URLSearchParams({ query })
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.prefix) params.set('prefix', options.prefix)

  const response = await fetchWithTimeout(`${ICONIFY_API}/search?${params}`)
  if (!response.ok) throw new Error(`Iconify search error: ${response.status}`)
  const data = await response.json()
  const icons: string[] = data.icons ?? []
  const limit = options?.limit ?? 5
  return {
    icons: icons.slice(0, limit),
    total: data.total ?? 0,
    collections: data.collections ?? {}
  }
}
