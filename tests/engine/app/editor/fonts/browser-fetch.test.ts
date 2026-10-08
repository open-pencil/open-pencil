import { afterEach, describe, expect, test } from 'bun:test'

import { browserWebFontFetch, createBrowserWebFontFetch } from '@/app/editor/fonts/browser-fetch'

import { fetchStub } from '#tests/helpers/fetch'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('browser web font fetch', () => {
  test('rejects unapproved and non-HTTPS provider URLs', async () => {
    await expect(browserWebFontFetch('https://example.com/font.ttf')).rejects.toThrow(
      'Unsupported web font host'
    )
    await expect(browserWebFontFetch('http://fonts.gstatic.com/font.ttf')).rejects.toThrow(
      'Unsupported web font host'
    )
  })

  test('allows same-origin application resources through the temporary font proxy', async () => {
    const fontFetch = createBrowserWebFontFetch(
      fetchStub(
        async () =>
          new Response(new Uint8Array([1]), {
            headers: { 'content-length': String(36 * 1024 * 1024) }
          })
      ),
      'http://127.0.0.1:4301'
    )
    await expect(fontFetch('http://127.0.0.1:4301/gold-preview.fig')).resolves.toBeInstanceOf(
      Response
    )
  })
  test('returns bounded responses from approved provider hosts', async () => {
    const fontFetch = createBrowserWebFontFetch(
      fetchStub(
        async () =>
          new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { 'content-type': 'font/ttf' }
          })
      )
    )

    const response = await fontFetch('https://fonts.gstatic.com/font.ttf')

    expect(response.status).toBe(200)
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3])
  })

  test('passes cancellation through browser font downloads', async () => {
    const observedSignals: AbortSignal[] = []
    const fontFetch = createBrowserWebFontFetch(
      fetchStub(async (input) => {
        if (input instanceof Request) observedSignals.push(input.signal)
        return new Response(new Uint8Array([1, 2, 3]))
      })
    )
    const abort = new AbortController()

    await fontFetch('https://fonts.gstatic.com/font.ttf', { signal: abort.signal })
    abort.abort()

    expect(observedSignals[0]?.aborted).toBe(true)
  })
  test('rejects provider responses over the font size limit', async () => {
    const fontFetch = createBrowserWebFontFetch(
      fetchStub(
        async () =>
          new Response(null, {
            status: 200,
            headers: { 'content-length': String(9 * 1024 * 1024) }
          })
      )
    )

    await expect(fontFetch('https://cdn.jsdelivr.net/font.ttf')).rejects.toThrow('size limit')
  })
})
