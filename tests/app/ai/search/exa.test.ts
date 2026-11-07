import { describe, expect, test } from 'bun:test'

import { checkExaKey, exaWebSearch, type ExaFetch } from '@/app/ai/search/exa'
import { WebSearchRefusedError } from '@/app/ai/tools/web-search'

/** Exa answering every request with `answer`, recording what it was sent. */
function exa(answer: () => Response) {
  const requests: { url: string; init: RequestInit }[] = []
  const fetch: ExaFetch = async (url, init) => {
    requests.push({ url, init })
    return answer()
  }
  return { fetch, requests }
}

const key = async () => 'exa-key'

describe("searching with one's own Exa key", () => {
  test("asks for the query's highlights and reads them as each page's excerpt", async () => {
    const service = exa(() =>
      Response.json({
        results: [
          {
            url: 'https://example.com/grids',
            title: 'Grids',
            publishedDate: '2030-01-02',
            author: 'Ada',
            highlights: ['Columns', 'and gutters.']
          },
          { url: 'not a url', title: 'Broken' }
        ]
      })
    )
    const search = exaWebSearch(key, service.fetch)
    expect(await search({ query: 'grids', numResults: 3 })).toEqual({
      results: [
        {
          url: 'https://example.com/grids',
          title: 'Grids',
          publishedAt: '2030-01-02T00:00:00.000Z',
          author: 'Ada',
          text: 'Columns\n\nand gutters.'
        }
      ]
    })
    const [request] = service.requests
    expect(request?.url).toBe('https://api.exa.ai/search')
    expect(new Headers(request?.init.headers).get('x-api-key')).toBe('exa-key')
    expect(JSON.parse(String(request?.init.body))).toMatchObject({
      query: 'grids',
      numResults: 3,
      contents: { highlights: { maxCharacters: 2_000 } }
    })
  })

  test('tells the model when Exa refuses the key or there is none', async () => {
    const refused = exaWebSearch(key, exa(() => new Response('', { status: 401 })).fetch)
    await expect(refused({ query: 'grids' })).rejects.toBeInstanceOf(WebSearchRefusedError)
    const missing = exaWebSearch(async () => null, exa(() => Response.json({ results: [] })).fetch)
    await expect(missing({ query: 'grids' })).rejects.toBeInstanceOf(WebSearchRefusedError)
  })

  test('checks a key with one search', async () => {
    expect(await checkExaKey('exa-key', exa(() => Response.json({ results: [] })).fetch)).toBe('ok')
    expect(await checkExaKey('bad', exa(() => new Response('', { status: 401 })).fetch)).toBe(
      'rejected'
    )
    expect(await checkExaKey('busy', exa(() => new Response('', { status: 429 })).fetch)).toBe(
      'rate-limited'
    )
    const offline: ExaFetch = async () => {
      throw new TypeError('offline')
    }
    expect(await checkExaKey('exa-key', offline)).toBe('network')
  })
})
