import { describe, expect, test } from 'bun:test'

import { parseFigFile } from '#core/io/formats/fig/read'

describe('FIG parsing cancellation', () => {
  test('rejects before synchronous parsing when already aborted', async () => {
    const abort = new AbortController()
    abort.abort()

    await expect(parseFigFile(new ArrayBuffer(0), { signal: abort.signal })).rejects.toHaveProperty(
      'name',
      'AbortError'
    )
  })
})
