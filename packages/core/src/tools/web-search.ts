import * as v from 'valibot'

import { defineTool } from './schema'

/** The most pages one search returns. */
export const MAX_WEB_SEARCH_RESULTS = 10
/** The longest query a search takes, in characters. */
export const MAX_WEB_SEARCH_QUERY_LENGTH = 1_000

/** One page a search found, with the part of its text that answers the query. */
export interface WebSearchResult {
  url: string
  title: string
  publishedAt: string | null
  author: string | null
  text: string
}

/** Where searches go: the person's own key, or the Cloud plan that pays for the model. */
export interface WebSearchProvider {
  search(request: { query: string; numResults: number }): Promise<{ results: WebSearchResult[] }>
}

/** A search the provider refused for a reason the model should pass on to the person. */
export class WebSearchRefusedError extends Error {
  override readonly name = 'WebSearchRefusedError'
}

let provider: WebSearchProvider | null = null

/** Sets where `web_search` sends searches; `null` when there is nowhere to search. */
export function setWebSearchProvider(next: WebSearchProvider | null): void {
  provider = next
}

export const webSearch = defineTool({
  name: 'web_search',
  description:
    'Search the web for current facts, references, examples, or real copy a design needs. ' +
    'Returns pages with their title, URL, date, author, and an excerpt. Each search costs ' +
    'money, so search only for what the conversation and document do not already answer.',
  execution: { kind: 'async', mutation: 'none' },
  // A page's WebMCP gets document tools only; a search spends the person's money.
  exposure: { webmcp: false },
  capabilities: ['network:access'],
  input: v.strictObject({
    query: v.pipe(
      v.string(),
      v.minLength(1),
      v.maxLength(MAX_WEB_SEARCH_QUERY_LENGTH),
      v.description(
        `What to look for, in natural language, up to ${MAX_WEB_SEARCH_QUERY_LENGTH} characters`
      )
    ),
    numResults: v.optional(
      v.pipe(
        v.number(),
        v.integer(),
        v.minValue(1),
        v.maxValue(MAX_WEB_SEARCH_RESULTS),
        v.description(`Pages to return, up to ${MAX_WEB_SEARCH_RESULTS}; 5 by default`)
      )
    )
  }),
  execute: async (_figma, { query, numResults = 5 }) => {
    if (!provider) {
      return {
        error:
          'Web search is not set up. Ask the user to add an Exa key in Settings › Integrations, ' +
          'or to use an OpenPencil Cloud model whose plan includes search.'
      }
    }
    try {
      return await provider.search({ query: query.trim(), numResults })
    } catch (error) {
      if (error instanceof WebSearchRefusedError) return { error: error.message }
      console.warn('Web search failed', error)
      return { error: 'The search failed.' }
    }
  }
})
