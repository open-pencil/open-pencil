import { describe, expect, spyOn, test } from 'bun:test'

import { resolveFigmaClipboardImages } from '@/app/editor/clipboard/figma-images'

import { expectDefined } from '#tests/helpers/assert'

async function sha1Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-1', Uint8Array.from(bytes))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
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
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    const fetcher = async (input: RequestInfo | URL) => {
      if (String(input).includes('/image/batch')) {
        return Response.json({
          error: false,
          status: 200,
          meta: {
            s3_urls: {
              '1111111111111111111111111111111111111111': 'https://s3-alpha-sig.figma.com/image'
            }
          }
        })
      }
      return new Response(new Uint8Array([9, 9, 9]))
    }

    const images = await resolveFigmaClipboardImages(
      'file-key',
      ['1111111111111111111111111111111111111111'],
      fetcher
    )

    expect(images.size).toBe(0)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
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
