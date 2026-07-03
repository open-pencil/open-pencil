import { describe, expect, test } from 'bun:test'

import { withWebFontFetchProxy, type WebFontFetch } from '#core/text/web-fonts'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function bodyText(body: BodyInit | null | undefined): Promise<string> {
  if (!body) return ''
  if (typeof body === 'string') return body
  if (body instanceof Blob) return body.text()
  if (body instanceof URLSearchParams) return body.toString()
  if (body instanceof ArrayBuffer) return new TextDecoder().decode(body)
  if (ArrayBuffer.isView(body)) return new TextDecoder().decode(body)
  throw new Error(`Unsupported test body type: ${Object.prototype.toString.call(body)}`)
}

describe('web font fetch proxy', () => {
  test('serializes overlapping global fetch proxy operations and restores the original fetch', async () => {
    const originalFetch = globalThis.fetch
    const fetchedUrls: string[] = []
    const fetcher: WebFontFetch = async (url) => {
      fetchedUrls.push(url)
      return new Response('ok')
    }

    try {
      await Promise.all([
        withWebFontFetchProxy(fetcher, async () => {
          await delay(5)
          const response = await fetch('https://fonts.example/one')
          expect(await response.text()).toBe('ok')
        }),
        withWebFontFetchProxy(fetcher, async () => {
          await delay(20)
          const response = await fetch('https://fonts.example/two')
          expect(await response.text()).toBe('ok')
        })
      ])

      expect(fetchedUrls.filter((url) => url.startsWith('https://fonts.example/'))).toEqual([
        'https://fonts.example/one',
        'https://fonts.example/two'
      ])
      expect(globalThis.fetch).toBe(originalFetch)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('preserves Request method headers and body through the proxy', async () => {
    const originalFetch = globalThis.fetch
    let captured:
      | {
          url: string
          method: string | undefined
          header: string | null
          body: string
        }
      | undefined
    const fetcher: WebFontFetch = async (url, init) => {
      captured = {
        url,
        method: init?.method,
        header: new Headers(init?.headers).get('x-font-provider'),
        body: await bodyText(init?.body)
      }
      return new Response('ok')
    }

    try {
      const request = new Request('https://fonts.example/metadata', {
        method: 'POST',
        headers: { 'x-font-provider': 'google' },
        body: 'payload'
      })

      const response = await withWebFontFetchProxy(fetcher, () => fetch(request))

      expect(await response.text()).toBe('ok')
      expect(captured).toEqual({
        url: 'https://fonts.example/metadata',
        method: 'POST',
        header: 'google',
        body: 'payload'
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
