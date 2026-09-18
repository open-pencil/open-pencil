import { afterEach, describe, expect, mock, test } from 'bun:test'

import { readBoundedBody } from '@/app/document/io/browser'
import { openBrowserFileFromURL } from '@/app/shell/menu/files'

const MIB = 1024 * 1024
const originalFetch = globalThis.fetch

function streamed(chunks: number[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const size of chunks) controller.enqueue(new Uint8Array(size))
        controller.close()
      }
    })
  )
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('readBoundedBody', () => {
  test('buffers a body that stays under the cap', async () => {
    const onExceeded = mock(() => undefined)

    const bytes = await readBoundedBody(streamed([20, 10]), MIB, { onExceeded })

    expect(bytes.byteLength).toBe(30)
    expect(onExceeded).not.toHaveBeenCalled()
  })

  test('aborts the request as soon as the cap is exceeded', async () => {
    const onExceeded = mock(() => undefined)
    // The third chunk pushes it over: the read stops there instead of draining the
    // body, and the notice names the cap the user has to stay under.
    const body = streamed([MIB / 2, MIB / 2, 1, 64 * MIB])

    await expect(readBoundedBody(body, MIB, { onExceeded })).rejects.toThrow('exceeds 1 MiB')
    expect(onExceeded).toHaveBeenCalledTimes(1)
  })

  test('accepts a body of exactly the cap and refuses one byte more', async () => {
    const onExceeded = mock(() => undefined)

    const exact = await readBoundedBody(streamed([MIB / 2, MIB / 2]), MIB, { onExceeded })
    expect(exact.byteLength).toBe(MIB)
    expect(onExceeded).not.toHaveBeenCalled()

    await expect(readBoundedBody(streamed([MIB, 1]), MIB, { onExceeded })).rejects.toThrow(
      'exceeds'
    )
    expect(onExceeded).toHaveBeenCalledTimes(1)
  })

  test('counts the bytes that arrive, not a Content-Length claim', async () => {
    const response = streamed([MIB, MIB])
    response.headers.set('Content-Length', '1')
    const onExceeded = mock(() => undefined)

    await expect(readBoundedBody(response, MIB, { onExceeded })).rejects.toThrow('exceeds')
    expect(onExceeded).toHaveBeenCalledTimes(1)
  })

  test('lets a caller name its own oversized-body error', async () => {
    await expect(
      readBoundedBody(streamed([MIB, 1]), MIB, { sizeError: 'Vectorized SVG is too large' })
    ).rejects.toThrow('Vectorized SVG is too large')
  })
})

describe('openBrowserFileFromURL', () => {
  test('refuses a response with no body instead of opening an empty document', async () => {
    globalThis.fetch = mock(async () => new Response(null, { status: 200 })) as typeof fetch

    await expect(openBrowserFileFromURL(new URL('https://example.com/design.pen'))).rejects.toThrow(
      'carried no body'
    )
  })
})
