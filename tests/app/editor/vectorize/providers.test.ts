import { describe, expect, spyOn, test } from 'bun:test'

import {
  extractVectorizedSVGURL,
  getVectorizeProvider,
  validateVectorizedAssetURL
} from '@/app/editor/vectorize/providers'
import { appCredentialRefs } from '@/app/settings/credentials/persistence'
import { credentialKey } from '@/app/settings/credentials/reference'

import { fetchStub } from '#tests/helpers/fetch'

describe('vectorization providers', () => {
  test('extracts supported nested SVG response URLs', () => {
    expect(extractVectorizedSVGURL({ image: { url: 'https://cdn.recraft.ai/a.svg' } })).toBe(
      'https://cdn.recraft.ai/a.svg'
    )
    expect(extractVectorizedSVGURL({ data: [{ url: 'https://v3.fal.media/a.svg' }] })).toBe(
      'https://v3.fal.media/a.svg'
    )
    expect(extractVectorizedSVGURL({ data: { image: { url: 'https://fal.media/a.svg' } } })).toBe(
      'https://fal.media/a.svg'
    )
  })

  test('allows only provider-owned HTTPS asset hosts', () => {
    expect(validateVectorizedAssetURL('recraft', 'https://cdn.recraft.ai/a.svg').hostname).toBe(
      'cdn.recraft.ai'
    )
    expect(validateVectorizedAssetURL('fal', 'https://v3.fal.media/a.svg').hostname).toBe(
      'v3.fal.media'
    )
    expect(() => validateVectorizedAssetURL('recraft', 'https://example.com/a.svg')).toThrow(
      'untrusted'
    )
    expect(() => validateVectorizedAssetURL('fal', 'http://fal.media/a.svg')).toThrow('untrusted')
  })

  test('rejects redirects from trusted asset hosts to untrusted hosts', async () => {
    let requestCount = 0
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      fetchStub(async () => {
        requestCount += 1
        if (requestCount === 1) {
          return Response.json({ image: { url: 'https://cdn.recraft.ai/result.svg' } })
        }
        const response = new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', {
          headers: { 'content-type': 'image/svg+xml' }
        })
        Object.defineProperty(response, 'url', { value: 'https://example.com/result.svg' })
        return response
      })
    )

    try {
      await expect(
        getVectorizeProvider('recraft').vectorize(new Uint8Array([1, 2, 3]), 'secret')
      ).rejects.toThrow('untrusted')
      expect(requestCount).toBe(2)
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test('includes vectorization keys in browser persistence changes', () => {
    const keys = appCredentialRefs().map(credentialKey)
    expect(keys).toContain('v1:vectorize-recraft:default:api-key')
    expect(keys).toContain('v1:vectorize-fal:default:api-key')
    expect(keys).toContain('v1:vectorize-quiver:default:api-key')
  })

  test('Quiver sends the image to Arrow 2 and returns the SVG its answer carries', async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><path d="M0 0h4v4z"/></svg>'
    const requests: { url: string; init?: RequestInit }[] = []
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      fetchStub(async (input, init) => {
        requests.push({ url: String(input), init })
        return Response.json({
          id: 'resp_1',
          created: 1,
          data: [{ mime_type: 'image/svg+xml', svg }]
        })
      })
    )
    try {
      expect(
        await getVectorizeProvider('quiver').vectorize(new Uint8Array([1, 2, 3]), 'sk_test_1')
      ).toBe(svg)
      expect(requests).toHaveLength(1)
      expect(requests[0].url).toBe('https://api.quiver.ai/v1/svgs/vectorizations')
      expect(new Headers(requests[0].init?.headers).get('authorization')).toBe('Bearer sk_test_1')
      expect(JSON.parse(String(requests[0].init?.body))).toEqual({
        model: 'arrow-2',
        image: { base64: 'AQID' },
        stream: false
      })
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test('Quiver reports a rejected key, a frozen account and an answer without an SVG apart', async () => {
    const answers = [
      new Response('{"error":"invalid key"}', { status: 401 }),
      Response.json({ code: 'account_frozen' }, { status: 403 }),
      Response.json({ id: 'resp_1', created: 1, data: [] })
    ]
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      fetchStub(async () => answers.shift() ?? new Response(null, { status: 500 }))
    )
    const quiver = getVectorizeProvider('quiver')
    try {
      await expect(quiver.vectorize(new Uint8Array([1]), 'bad')).rejects.toThrow(
        'QuiverAI API key was rejected'
      )
      await expect(quiver.vectorize(new Uint8Array([1]), 'key')).rejects.toThrow(
        'QuiverAI vectorization failed (403)'
      )
      await expect(quiver.vectorize(new Uint8Array([1]), 'key')).rejects.toThrow(
        'QuiverAI returned no SVG'
      )
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test('an answer that stalls after its headers times out instead of waiting forever', async () => {
    const realSetTimeout = globalThis.setTimeout
    // The deadline runs out at once, after the headers have arrived.
    const timerSpy = spyOn(globalThis, 'setTimeout').mockImplementation(((handler: () => void) =>
      realSetTimeout(handler, 0)) as typeof setTimeout)
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      fetchStub(async (_input, init) => {
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"data":['))
            init?.signal?.addEventListener('abort', () =>
              controller.error(new DOMException('aborted', 'AbortError'))
            )
          }
        })
        return new Response(body)
      })
    )
    try {
      await expect(
        getVectorizeProvider('quiver').vectorize(new Uint8Array([1]), 'key')
      ).rejects.toThrow('timed out')
    } finally {
      fetchSpy.mockRestore()
      timerSpy.mockRestore()
    }
  })
})
