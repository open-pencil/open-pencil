import { beforeAll, describe, expect, it } from 'bun:test'
import { deflateSync, unzipSync } from 'fflate'

import { parseFigBuffer, writeFigArchive } from '#fig/index'
import {
  readZipEntries,
  renameFigArchiveStream,
  writeFigArchiveStream,
  writeZipStream
} from '#fig/archive/zip'

import {
  createNodeChangesMessage,
  encodeMessage,
  getSchemaBytes,
  initCodec
} from '@open-pencil/kiwi/fig/codec'
import { buildFigKiwi } from '@open-pencil/kiwi/fig/container'

function documentData(): Uint8Array {
  return encodeMessage(
    createNodeChangesMessage(0, 0, [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', phase: 'CREATED', name: 'Doc' }
    ])
  )
}

function canvas(): Uint8Array {
  return buildFigKiwi(deflateSync(getSchemaBytes()), documentData())
}

function archive(images: Array<{ name: string; data: Uint8Array }> = []): Uint8Array {
  return writeFigArchive({
    schemaDeflated: deflateSync(getSchemaBytes()),
    kiwiData: documentData(),
    thumbnailPNG: new Uint8Array([1, 2, 3]),
    metaJSON: '{"file_name":"test"}',
    images
  })
}

function collect() {
  const chunks: Uint8Array[] = []
  const sink = (chunk: Uint8Array) => {
    chunks.push(chunk)
  }
  return {
    chunks,
    sink,
    bytes() {
      const total = chunks.reduce((length, chunk) => length + chunk.byteLength, 0)
      const bytes = new Uint8Array(total)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
      }
      return bytes
    }
  }
}

describe('streaming .fig archives', () => {
  beforeAll(async () => {
    await initCodec()
  })

  it('writes the same archive entries as the in-memory writer without a buffer copy', async () => {
    const images = [
      { name: 'images/one', data: new Uint8Array(4096).fill(7) },
      { name: 'images/two', data: new Uint8Array(8192).fill(9) }
    ]
    const expected = archive(images)
    const output = collect()

    await writeFigArchiveStream(
      {
        canvasFig: canvas(),
        thumbnailPNG: new Uint8Array([1, 2, 3]),
        metaJSON: '{"file_name":"test"}',
        images
      },
      output.sink
    )

    expect(unzipSync(output.bytes())).toEqual(unzipSync(expected))
    const parsed = parseFigBuffer(output.bytes().slice().buffer as ArrayBuffer)
    expect(parsed.nodeChanges[0]?.type).toBe('DOCUMENT')
    expect(parsed.images).toEqual(images.map((image) => [image.name.slice(7), image.data]))
    expect(new DataView(output.bytes().buffer).getUint16(6, true) & 0x8).toBe(0)
  })

  it('reports the exact number of bytes written', async () => {
    const output = collect()
    const progress: number[] = []
    let total = 0

    await writeFigArchiveStream(
      {
        canvasFig: canvas(),
        thumbnailPNG: new Uint8Array([1]),
        metaJSON: '{}',
        images: [{ name: 'images/large', data: new Uint8Array(100_000) }]
      },
      output.sink,
      {
        onProgress(written, expected) {
          progress.push(written)
          total = expected
        }
      }
    )

    expect(total).toBe(output.bytes().byteLength)
    expect(progress.at(-1)).toBe(total)
    expect(progress).toEqual([...progress].sort((left, right) => left - right))
  })

  it('renames the meta.json of a streamed archive and keeps its other entries', async () => {
    const original = writeFigArchive({
      schemaDeflated: deflateSync(getSchemaBytes()),
      kiwiData: documentData(),
      thumbnailPNG: new Uint8Array([1, 2, 3]),
      metaJSON: '{"file_name":"Old","extra":true}',
      images: [{ name: 'images/one', data: new Uint8Array([4, 5, 6]) }]
    })
    const output = collect()

    const renamed = await renameFigArchiveStream(original, 'New', output.sink)

    expect(renamed).toBe(true)
    const parsed = parseFigBuffer(output.bytes().slice().buffer as ArrayBuffer)
    expect(parsed.metaJSON).toBe('{"file_name":"New","extra":true}')
    expect(parsed.images).toEqual([['one', new Uint8Array([4, 5, 6])]])
  })

  it('copies stored and deflated entries from an archive without re-encoding them', async () => {
    const original = archive([{ name: 'images/one', data: new Uint8Array([5, 6, 7]) }])
    const entries = readZipEntries(original)
    const output = collect()

    await writeZipStream(
      entries.map((entry) => ({
        name: entry.name,
        source: original,
        offset: entry.dataOffset,
        compressedSize: entry.compressedSize,
        method: entry.method as 0 | 8,
        crc: entry.crc,
        uncompressedSize: entry.uncompressedSize
      })),
      output.sink
    )

    expect(unzipSync(output.bytes())).toEqual(unzipSync(original))
    expect(readZipEntries(output.bytes()).map((entry) => entry.method)).toEqual(
      entries.map((entry) => entry.method)
    )
    expect(entries.find((entry) => entry.name === 'meta.json')?.method).toBe(8)
  })
})
