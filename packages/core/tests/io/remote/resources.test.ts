import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { imageDataURL } from '@open-pencil/scene-graph/images'
import { fetchStub } from '@open-pencil/test-support/fetch'
import { FIXTURES } from '@open-pencil/test-support/paths'

import { networkResourceFetch } from '#core/io/remote/resources'

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
})
