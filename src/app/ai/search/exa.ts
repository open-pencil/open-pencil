import * as v from 'valibot'

import { searchResultSchema, type SearchResult } from '@open-pencil/cloud/contract'
import type { StockPhotoKeyCheck } from '@open-pencil/core/tools'

import { WebSearchRefusedError, type WebSearch } from '@/app/ai/tools/web-search'
import { tauriFetch } from '@/app/tauri/http'

const EXA_SEARCH_URL = 'https://api.exa.ai/search'
/** The longest excerpt a result carries, in characters. */
const EXCERPT_CHARACTERS = 2_000
const TIMEOUT_MS = 30_000
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024

const answerSchema = v.object({
  results: v.array(
    v.object({
      url: v.string(),
      title: v.nullish(v.string()),
      publishedDate: v.nullish(v.string()),
      author: v.nullish(v.string()),
      highlights: v.nullish(v.array(v.string()))
    })
  )
})
const answerBodySchema = v.pipe(v.string(), v.parseJson(), answerSchema)

function timestamp(value: string | null | undefined): string | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

export type ExaFetch = (url: string, init: RequestInit) => Promise<Response>

// Exa refuses browsers' cross-origin requests, so a key of one's own works through the desktop
// app's native fetch.
const nativeFetch: ExaFetch = (url, init) => tauriFetch(url, init, MAX_RESPONSE_BYTES, TIMEOUT_MS)

function askExa(fetch: ExaFetch, key: string, query: string, numResults: number) {
  return fetch(EXA_SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key },
    body: JSON.stringify({
      query,
      numResults,
      type: 'auto',
      contents: { highlights: { maxCharacters: EXCERPT_CHARACTERS } }
    })
  })
}

/** Web search with the person's own Exa key, which Exa bills instead of Cloud credits. */
export function exaWebSearch(
  key: () => Promise<string | null>,
  fetch: ExaFetch = nativeFetch
): WebSearch {
  return async ({ query, numResults = 5 }) => {
    const saved = await key()
    if (!saved) throw new WebSearchRefusedError('The Exa key in Settings is missing.')
    const response = await askExa(fetch, saved, query, numResults)
    if (response.status === 401 || response.status === 403) {
      throw new WebSearchRefusedError('Exa refused the key saved in Settings.')
    }
    if (response.status === 429) throw new WebSearchRefusedError('Exa is rate limiting searches.')
    if (!response.ok) throw new Error(`Exa answered HTTP ${response.status}`)
    const parsed = v.safeParse(answerBodySchema, await response.text())
    if (!parsed.success) throw new Error('Exa answered with an unexpected body')
    const results: SearchResult[] = parsed.output.results
      .map((result) => ({
        url: result.url,
        title: result.title ?? '',
        publishedAt: timestamp(result.publishedDate),
        author: result.author || null,
        text: (result.highlights ?? []).join('\n\n')
      }))
      .filter((result) => v.is(searchResultSchema, result))
    return { results }
  }
}

/** Checks a key with a one-result search, which Exa bills like any other. */
export async function checkExaKey(
  key: string,
  fetch: ExaFetch = nativeFetch
): Promise<StockPhotoKeyCheck> {
  let response
  try {
    response = await askExa(fetch, key, 'OpenPencil', 1)
  } catch {
    return 'network'
  }
  if (response.ok) return 'ok'
  if (response.status === 429) return 'rate-limited'
  return response.status === 401 || response.status === 403 ? 'rejected' : 'failed'
}
