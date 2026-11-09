import { beforeAll, describe, expect, it } from 'bun:test'
import { deflateSync } from 'fflate'

import {
  parseFigBuffer,
  patchFigArchive,
  patchFigArchiveStream,
  readZipEntries,
  writeFigArchive,
  writeZipStream,
  type FigRecordPatch
} from '#fig/index'
import { storedZipEntry, deflatedZipEntry } from '#fig/archive/zip'

import {
  createNodeChangesMessage,
  encodeMessage,
  getSchemaBytes,
  initCodec
} from '@open-pencil/kiwi/fig/codec'
import { buildFigKiwi } from '@open-pencil/kiwi/fig/container'

const PATCH: FigRecordPatch = { records: [], blobs: [], removed: [], replaceVariables: false }

function canvas(): Uint8Array {
  return buildFigKiwi(
    deflateSync(getSchemaBytes()),
    encodeMessage(
      createNodeChangesMessage(0, 0, [
        { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', phase: 'CREATED', name: 'Doc' },
        {
          guid: { sessionID: 0, localID: 1 },
          type: 'CANVAS',
          phase: 'CREATED',
          name: 'Page',
          parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' }
        }
      ])
    )
  )
}

function archive(): Uint8Array {
  return writeFigArchive({
    schemaDeflated: deflateSync(getSchemaBytes()),
    kiwiData: encodeMessage(
      createNodeChangesMessage(0, 0, [
        { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', phase: 'CREATED', name: 'Doc' },
        {
          guid: { sessionID: 0, localID: 1 },
          type: 'CANVAS',
          phase: 'CREATED',
          name: 'Page',
          parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' }
        }
      ])
    ),
    thumbnailPNG: new Uint8Array([1, 2, 3]),
    metaJSON: '{"file_name":"Old"}',
    images: [
      { name: 'images/stored', data: new Uint8Array(50_000).fill(3) },
      { name: 'images/also-stored', data: new Uint8Array([9, 8, 7]) }
    ]
  })
}

async function collect(write: (sink: (chunk: Uint8Array) => Promise<void>) => Promise<void>) {
  const chunks: Uint8Array[] = []
  await write(async (chunk) => {
    chunks.push(chunk)
  })
  const total = chunks.reduce((length, chunk) => length + chunk.byteLength, 0)
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

describe('streaming .fig archive patches', () => {
  beforeAll(async () => {
    await initCodec()
  })

  it('writes the same document, images, thumbnail, and meta as the in-memory patch', async () => {
    const input = archive()
    const expected = patchFigArchive(
      input.slice().buffer as ArrayBuffer,
      PATCH,
      {
        thumbnailPNG: new Uint8Array([4, 5]),
        metaJSON: '{"file_name":"New"}',
        images: [{ name: 'images/new', data: new Uint8Array([1, 1, 1]) }]
      },
      deflateSync
    )
    const actual = await collect(async (sink) => {
      await patchFigArchiveStream(
        input.slice().buffer as ArrayBuffer,
        PATCH,
        {
          thumbnailPNG: new Uint8Array([4, 5]),
          metaJSON: '{"file_name":"New"}',
          images: [{ name: 'images/new', data: new Uint8Array([1, 1, 1]) }]
        },
        deflateSync,
        sink
      )
    })

    const expectedParsed = parseFigBuffer(expected.slice().buffer as ArrayBuffer)
    const actualParsed = parseFigBuffer(actual.slice().buffer as ArrayBuffer)
    expect(actualParsed.nodeChanges).toEqual(expectedParsed.nodeChanges)
    expect(actualParsed.images).toEqual(expectedParsed.images)
    expect(actualParsed.thumbnailPNG).toEqual(new Uint8Array([4, 5]))
    expect(actualParsed.metaJSON).toBe('{"file_name":"New"}')
    expect(actualParsed.kind).toBe(expectedParsed.kind)
  })

  it('copies images an archive stored with deflate as well as stored ones', async () => {
    const canvasFig = canvas()
    const image = new TextEncoder().encode('a deflated image payload '.repeat(500))
    const input = await collect(async (sink) => {
      await writeZipStream(
        [
          storedZipEntry('canvas.fig', canvasFig),
          storedZipEntry('thumbnail.png', new Uint8Array([1])),
          deflatedZipEntry('meta.json', new TextEncoder().encode('{"file_name":"Old"}')),
          deflatedZipEntry('images/deflated', image)
        ],
        sink
      )
    })
    const output = await collect(async (sink) => {
      await patchFigArchiveStream(
        input.slice().buffer as ArrayBuffer,
        PATCH,
        {
          thumbnailPNG: new Uint8Array([2]),
          metaJSON: '{"file_name":"Old"}',
          images: []
        },
        deflateSync,
        sink
      )
    })

    const parsed = parseFigBuffer(output.slice().buffer as ArrayBuffer)
    expect(parsed.images).toEqual([['deflated', image]])
    expect(readZipEntries(output).find((entry) => entry.name === 'images/deflated')?.method).toBe(8)
  })
})
