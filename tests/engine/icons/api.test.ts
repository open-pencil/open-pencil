import { describe, expect, mock, test } from 'bun:test'

import { createIconifyAPIClient } from '#core/icons/api'

function createMockFetch(responder: (request: Request) => Response) {
  return mock(async (input: RequestInfo | URL, init?: RequestInit) =>
    responder(new Request(input, init))
  ) as typeof fetch
}

describe('Iconify API client', () => {
  test('encodes collection query parameters through ofetch', async () => {
    const fetcher = createMockFetch((request) => {
      expect(request.method).toBe('GET')
      const url = new URL(request.url)
      expect(url.origin).toBe('https://icons.example')
      expect(url.pathname).toBe('/lucide.json')
      expect(url.searchParams.get('icons')).toBe('home,search')
      return Response.json({
        prefix: 'lucide',
        icons: {
          home: { body: '<path />' },
          search: { body: '<path />' }
        }
      })
    })
    const client = createIconifyAPIClient(fetcher, 'https://icons.example')

    const result = await client.fetchCollection('lucide', ['home', 'search'])

    expect(result.prefix).toBe('lucide')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  test('passes search options and applies the requested result limit', async () => {
    const fetcher = createMockFetch((request) => {
      const url = new URL(request.url)
      expect(url.pathname).toBe('/search')
      expect(url.searchParams.get('query')).toBe('arrow left')
      expect(url.searchParams.get('limit')).toBe('2')
      expect(url.searchParams.get('prefix')).toBe('lucide')
      return Response.json({
        icons: ['lucide:arrow-left', 'lucide:arrow-right', 'lucide:arrow-up'],
        total: 3,
        collections: {}
      })
    })
    const client = createIconifyAPIClient(fetcher, 'https://icons.example')

    const result = await client.search('arrow left', { limit: 2, prefix: 'lucide' })

    expect(result.icons).toEqual(['lucide:arrow-left', 'lucide:arrow-right'])
  })

  test('preserves contextual HTTP error messages without retrying', async () => {
    const fetcher = createMockFetch(() => new Response('Unavailable', { status: 503 }))
    const client = createIconifyAPIClient(fetcher, 'https://icons.example')

    await expect(client.fetchCollection('lucide', ['home'])).rejects.toThrow(
      'Iconify API error: 503 for prefix "lucide"'
    )
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
