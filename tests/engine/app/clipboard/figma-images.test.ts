import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'

import { resolveFigmaClipboardImages } from '@/app/editor/clipboard/figma-images'

import { expectDefined } from '#tests/helpers/assert'

async function sha1Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-1', Uint8Array.from(bytes))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const HASH = '1111111111111111111111111111111111111111'

/**
 * The warnings `resolveFigmaClipboardImages` printed. The spy is on the global `console`, so it
 * also catches warnings other code prints meanwhile; counting only these keeps the tests exact.
 */
function pastedImageWarnings() {
  const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
  return () =>
    warn.mock.calls.filter(([message]) => String(message).startsWith('Failed to fetch pasted'))
}

afterEach(() => {
  mock.restore()
})

function pendingResponseUntilAbort(_input: RequestInfo | URL, init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal
    if (!signal) {
      reject(new Error('Expected request signal'))
      return
    }
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
}

describe('resolveFigmaClipboardImages', () => {
  test('resolves signed URLs, verifies bytes, and deduplicates hashes', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const hash = await sha1Hex(bytes)
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, init })
      if (url.includes('/image/batch')) {
        return Response.json({
          error: false,
          status: 200,
          meta: { s3_urls: { [hash]: 'https://s3-alpha-sig.figma.com/image' } }
        })
      }
      return new Response(Uint8Array.from(bytes))
    }

    const images = await resolveFigmaClipboardImages('file/key', [hash, hash], fetcher)

    expect(images.get(hash)).toEqual(bytes)
    expect(requests.map(({ url }) => url)).toEqual([
      'https://www.figma.com/file/file%2Fkey/image/batch',
      'https://s3-alpha-sig.figma.com/image'
    ])
    const body = expectDefined(requests[0].init?.body, 'batch request body')
    expect(JSON.parse(String(body))).toEqual({
      sha1s: [hash],
      needs_compressed_textures: false
    })
  })

  test('drops a response whose bytes do not match the Figma hash', async () => {
    const warnings = pastedImageWarnings()
    const fetcher = async (input: RequestInfo | URL) => {
      if (String(input).includes('/image/batch')) {
        return Response.json({
          error: false,
          status: 200,
          meta: {
            s3_urls: { [HASH]: 'https://s3-alpha-sig.figma.com/image' }
          }
        })
      }
      return new Response(new Uint8Array([9, 9, 9]))
    }

    const images = await resolveFigmaClipboardImages('file-key', [HASH], fetcher)

    expect(images.size).toBe(0)
    expect(warnings()).toEqual([[`Failed to fetch pasted Figma image ${HASH}`, expect.anything()]])
  })

  test('times out stalled batch requests', async () => {
    await expect(
      resolveFigmaClipboardImages('file-key', ['hash'], pendingResponseUntilAbort, 5)
    ).rejects.toMatchObject({ name: 'TimeoutError' })
  })

  test('drops images whose signed URL request times out', async () => {
    const warnings = pastedImageWarnings()
    const images = await resolveFigmaClipboardImages(
      'file-key',
      [HASH],
      (input, init) => {
        if (String(input).includes('/image/batch')) {
          return Promise.resolve(
            Response.json({
              error: false,
              status: 200,
              meta: {
                s3_urls: { [HASH]: 'https://s3-alpha-sig.figma.com/image' }
              }
            })
          )
        }
        return pendingResponseUntilAbort(input, init)
      },
      5
    )

    expect(images.size).toBe(0)
    expect(warnings()).toEqual([[`Failed to fetch pasted Figma image ${HASH}`, expect.anything()]])
  })

  test('rejects failed and malformed batch responses', async () => {
    await expect(
      resolveFigmaClipboardImages('file-key', ['hash'], async () =>
        Response.json({}, { status: 503 })
      )
    ).rejects.toThrow('status 503')

    await expect(
      resolveFigmaClipboardImages('file-key', ['hash'], async () => Response.json({ error: true }))
    ).rejects.toThrow('invalid image response')
  })
})
