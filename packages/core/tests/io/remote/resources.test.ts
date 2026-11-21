import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { imageDataURL } from '@open-pencil/scene-graph/images'
import { fetchStub } from '@open-pencil/test-support/fetch'
import { FIXTURES } from '@open-pencil/test-support/paths'

import { MAX_PAGE_FILE_BYTES, MAX_REMOTE_FILE_BYTES, networkResourceFetch } from '#core/io/remote'

describe('networkResourceFetch', () => {
  test('reads a data URL from itself, sending nothing', async () => {
    const png = await Bun.file(join(FIXTURES, 'absolute-constraint-figma.png')).bytes()
    const requested: string[] = []
    const read = networkResourceFetch(
      fetchStub(async (input) => {
        requested.push(input instanceof Request ? input.url : input.toString())
        return new Response(null, { status: 404 })
      })
    )
    const url = imageDataURL(png)

    expect(await read(url, new AbortController().signal)).toEqual({
      url,
      bytes: png,
      contentType: 'image/png'
    })
    expect(requested).toEqual([])
  })

  test('leaves out a page file over its own cap, below the document cap', async () => {
    const size = MAX_PAGE_FILE_BYTES + 1
    expect(size).toBeLessThan(MAX_REMOTE_FILE_BYTES)
    const fetch = fetchStub(
      async () =>
        new Response(new ReadableStream<Uint8Array>(), {
          headers: { 'content-type': 'image/png', 'content-length': String(size) }
        })
    )

    const read = networkResourceFetch(fetch)
    expect(await read('https://example.com/huge.png', new AbortController().signal)).toBeNull()
  })
})
