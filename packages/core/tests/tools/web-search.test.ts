import { afterEach, describe, expect, test } from 'bun:test'

import { setWebSearchProvider, WebSearchRefusedError } from '@open-pencil/core/tools'

import { getTool, setupToolTest } from '#core-tests/helpers/tools'

const RESULT = {
  url: 'https://example.com/grids',
  title: 'Grids',
  publishedAt: null,
  author: null,
  text: 'Columns and gutters.'
}

function search(args: Record<string, unknown>) {
  const { figma } = setupToolTest()
  return getTool('web_search').execute(figma, args)
}

afterEach(() => setWebSearchProvider(null))

describe('web_search tool', () => {
  test('asks the provider with a trimmed query and five results by default', async () => {
    const asked: unknown[] = []
    setWebSearchProvider({
      async search(request) {
        asked.push(request)
        return { results: [RESULT] }
      }
    })
    expect(await search({ query: '  grid systems ' })).toEqual({ results: [RESULT] })
    expect(asked).toEqual([{ query: 'grid systems', numResults: 5 }])
  })

  test('tells the model how to set search up when there is no provider', async () => {
    expect(await search({ query: 'grids' })).toEqual({
      error: expect.stringContaining('Settings › Integrations')
    })
  })

  test("passes a provider's refusal on, and hides any other failure's details", async () => {
    setWebSearchProvider({
      async search() {
        throw new WebSearchRefusedError('The workspace is out of OpenPencil credits.')
      }
    })
    expect(await search({ query: 'grids' })).toEqual({
      error: 'The workspace is out of OpenPencil credits.'
    })
    setWebSearchProvider({
      async search() {
        throw new Error('socket hang up')
      }
    })
    expect(await search({ query: 'grids' })).toEqual({ error: 'The search failed.' })
  })

  test('refuses an empty query or too many results before searching', async () => {
    expect(() => search({ query: '' })).toThrow()
    expect(() => search({ query: 'grids', numResults: 11 })).toThrow()
  })
})
