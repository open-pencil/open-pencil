import { valibotSchema } from '@ai-sdk/valibot'
import { tool } from 'ai'
import * as v from 'valibot'

import {
  MAX_SEARCH_RESULTS,
  serviceErrorCodeSchema,
  type SearchRequestInput,
  type SearchResponse,
  type ServiceErrorCode
} from '@open-pencil/cloud/contract'

export const WEB_SEARCH_TOOL_NAME = 'web_search'

/** Runs one web search, which the chat's Cloud workspace pays for. */
export type WebSearch = (input: SearchRequestInput) => Promise<SearchResponse>

/** What the model is told when the service refuses a search, so it can tell the user. */
const REFUSALS: Partial<Record<ServiceErrorCode, string>> = {
  insufficient_credits:
    'The workspace is out of OpenPencil credits, so searches fail until they renew or more are added.',
  rate_limited: 'Too many requests at once. Try again shortly.',
  capability_unavailable: "This Cloud's services do not offer web search."
}

// Read by shape: the build without Cloud bundles none of the client, `CloudServiceError` included.
const serviceErrorSchema = v.object({
  name: v.literal('CloudServiceError'),
  code: serviceErrorCodeSchema
})

/** The `web_search` tool, offered only when the chat's Cloud workspace has search. */
export function createWebSearchTool(search: WebSearch) {
  return {
    [WEB_SEARCH_TOOL_NAME]: tool({
      description:
        'Search the web for current facts, references, examples, or real copy a design needs. ' +
        'Returns pages with their title, URL, date, author, and an excerpt. Each search costs ' +
        "the workspace's OpenPencil credits, so search only for what the conversation and " +
        'document do not already answer.',
      inputSchema: valibotSchema(
        v.object({
          query: v.pipe(v.string(), v.description('What to look for, in natural language')),
          numResults: v.optional(
            v.pipe(
              v.number(),
              v.integer(),
              v.minValue(1),
              v.maxValue(MAX_SEARCH_RESULTS),
              v.description(`Pages to return, up to ${MAX_SEARCH_RESULTS}; 5 by default`)
            )
          )
        })
      ),
      execute: async (input) => {
        try {
          return await search(input)
        } catch (error) {
          const refused = v.safeParse(serviceErrorSchema, error)
          const refusal = refused.success ? REFUSALS[refused.output.code] : undefined
          if (refusal) return { error: refusal }
          console.warn('Web search failed', error)
          return { error: 'The search failed.' }
        }
      }
    })
  }
}
