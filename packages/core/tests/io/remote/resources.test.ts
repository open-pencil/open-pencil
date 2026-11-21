import { describe, expect, test } from 'bun:test'

import { fetchStub } from '@open-pencil/test-support/fetch'

import { MAX_PAGE_FILE_BYTES, MAX_REMOTE_FILE_BYTES, networkResourceFetch } from '#core/io/remote'

describe('networkResourceFetch', () => {
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
