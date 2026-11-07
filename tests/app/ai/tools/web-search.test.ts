import { describe, expect, test } from 'bun:test'

import { CloudServiceError } from '@open-pencil/cloud/client'
import type { SearchRequestInput } from '@open-pencil/cloud/contract'

import { createWebSearchTool, type WebSearch } from '@/app/ai/tools/web-search'

function run(search: WebSearch, input: SearchRequestInput) {
  const execute = createWebSearchTool(search).web_search.execute
  if (!execute) throw new Error('web_search has no execute')
  return execute(input, { toolCallId: 'call-1', messages: [], context: {} })
}

describe('web_search', () => {
  test('returns what the search found', async () => {
    const asked: SearchRequestInput[] = []
    const result = await run(
      async (input) => {
        asked.push(input)
        return { results: [] }
      },
      { query: 'grid systems', numResults: 3 }
    )
    expect(result).toEqual({ results: [] })
    expect(asked).toEqual([{ query: 'grid systems', numResults: 3 }])
  })

  test('tells the model why the service refused, so it can tell the user', async () => {
    const result = await run(
      async () => {
        throw new CloudServiceError(402, 'insufficient_credits')
      },
      { query: 'grid systems' }
    )
    expect(result).toEqual({ error: expect.stringContaining('out of OpenPencil credits') })
  })

  test('reports any other failure without its details', async () => {
    const result = await run(
      async () => {
        throw new Error('socket hang up')
      },
      { query: 'grid systems' }
    )
    expect(result).toEqual({ error: 'The search failed.' })
  })
})
