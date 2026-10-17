import { describe, expect, test } from 'bun:test'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'

import { readBoundedBody, readDocumentWithAssets } from '@/app/document/io/assets'

/** A response whose body arrives as the chunks given, with no declared length. */
function streamed(chunks: Uint8Array[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    }
  })
  return new Response(body)
}

describe('reading an image body under a byte limit', () => {
  test('joins the chunks of a body that fits', async () => {
    const bytes = await readBoundedBody(
      streamed([new Uint8Array([1, 2]), new Uint8Array([3, 4])]),
      4
    )

    expect(bytes).toEqual(new Uint8Array([1, 2, 3, 4]))
  })

  test('stops at the limit instead of buffering a body that exceeds it', async () => {
    const bytes = await readBoundedBody(
      streamed([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])]),
      4
    )

    expect(bytes).toBeUndefined()
  })

  test('refuses a body whose declared length already exceeds the limit', async () => {
    const response = new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-length': '3' }
    })

    expect(await readBoundedBody(response, 2)).toBeUndefined()
  })
})

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2])
const REMOTE = 'https://cdn.example.com/hero.png'

/** A `.pen` document whose one fill points at a remote asset. */
function penFile(): File {
  const json = JSON.stringify({
    version: '2.8',
    children: [
      {
        type: 'frame',
        id: 'f1',
        name: 'Hero',
        width: 10,
        height: 10,
        fill: { type: 'image', url: REMOTE, mode: 'fit' }
      }
    ]
  })
  return new File([json], 'doc.pen', { type: 'application/json' })
}

/** Replaces `fetch` for one test, keeping the `preconnect` tests expect to find. */
async function withFetch(
  stub: (url: string, init?: RequestInit) => Promise<Response>,
  body: () => Promise<void>
): Promise<void> {
  const original = globalThis.fetch
  globalThis.fetch = Object.assign(stub, { preconnect: original.preconnect })
  try {
    await body()
  } finally {
    globalThis.fetch = original
  }
}

describe('opening a document while its images load', () => {
  test('reads nothing and opens nothing when the open was already cancelled', async () => {
    const io = new IORegistry(BUILTIN_IO_FORMATS)
    const controller = new AbortController()
    let downloads = 0
    controller.abort()

    await withFetch(
      async () => {
        downloads += 1
        return new Response(PNG)
      },
      async () => {
        await expect(
          readDocumentWithAssets(io, penFile(), undefined, undefined, controller.signal)
        ).rejects.toThrow()
      }
    )

    expect(downloads).toBe(0)
  })

  test('gives up on a download that is in flight when the open is cancelled', async () => {
    const io = new IORegistry(BUILTIN_IO_FORMATS)
    const controller = new AbortController()
    let downloads = 0

    await withFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          downloads += 1
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          )
          // Cancel the open while this download is still waiting for its first byte.
          queueMicrotask(() => controller.abort())
        }),
      async () => {
        await expect(
          readDocumentWithAssets(io, penFile(), undefined, undefined, controller.signal)
        ).rejects.toThrow()
      }
    )

    expect(downloads).toBe(1)
  })
})
