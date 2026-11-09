import { describe, expect, test } from 'bun:test'

import { pullStream, readStreamBytes, zipStream } from '#fig/zip/stream'
import { unzipSync } from 'fflate'

const IMAGE = new Uint8Array(3 * 1024 * 1024 + 5).map((_, index) => index % 251)

describe('zipStream', () => {
  test('writes an archive any ZIP reader opens, stored and deflated entries alike', async () => {
    const meta = new TextEncoder().encode('{"file_name":"Doc"}')
    const bytes = await readStreamBytes(
      zipStream([
        { name: 'images/large', data: IMAGE },
        { name: 'meta.json', data: meta, deflate: true },
        { name: 'empty', data: new Uint8Array() }
      ])
    )

    expect(unzipSync(bytes)).toEqual({
      'images/large': IMAGE,
      'meta.json': meta,
      empty: new Uint8Array()
    })
  })

  test('hands stored entries on as views of their bytes, in chunks its reader asks for', async () => {
    const reader = zipStream([{ name: 'images/large', data: IMAGE }]).getReader()
    const views: Uint8Array[] = []
    for (let next = await reader.read(); !next.done; next = await reader.read()) {
      if (next.value.buffer === IMAGE.buffer) views.push(next.value)
    }

    expect(views.map((view) => view.byteLength)).toEqual([1024 * 1024, 1024 * 1024, 1024 * 1024, 5])
  })

  test('pulls from its source only when it is read', async () => {
    let produced = 0
    const stream = pullStream({
      next: () => {
        produced++
        return { done: false, value: new Uint8Array(1) }
      }
    })
    await Promise.resolve()
    expect(produced).toBe(0)
    await stream.getReader().read()
    expect(produced).toBe(1)
  })
})
