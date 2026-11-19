import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { fromUint8Array } from 'js-base64'

import { fetchStub } from '@open-pencil/test-support/fetch'
import { FIXTURES } from '@open-pencil/test-support/paths'

import { networkResourceFetch } from '#core/io/remote/resources'

describe('networkResourceFetch', () => {
  test('reads a data URL from itself, sending nothing', async () => {
    const png = await Bun.file(join(FIXTURES, 'absolute-constraint-figma.png')).bytes()
    const requested: string[] = []
    const read = networkResourceFetch(
      fetchStub(async (input) => {
        requested.push(String(input))
        return new Response(null, { status: 404 })
      })
    )
    const url = `data:image/png;base64,${fromUint8Array(png)}`

    expect(await read(url)).toEqual({ url, bytes: png, contentType: 'image/png' })
    expect(requested).toEqual([])
  })
})
