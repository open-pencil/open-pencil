import { beforeAll, describe, expect, it } from 'bun:test'

import { deflateSync } from 'fflate'

import {
  createNodeChangesMessage,
  encodeMessage,
  getSchemaBytes,
  initCodec
} from '@open-pencil/kiwi/fig/codec'

import {
  FIG_PACKAGE_STATUS,
  assertFigPackageReady,
  parseFigBuffer,
  readFigContainer,
  writeFigArchive,
  writeFigContainer
} from '../src/index'

describe('@open-pencil/fig package API', () => {
  beforeAll(async () => {
    await initCodec()
  })

  it('exports archive API status', () => {
    expect(FIG_PACKAGE_STATUS).toBe('archive-api')
  })

  it('round-trips fig-kiwi container bytes', () => {
    const bytes = writeFigContainer({
      schemaDeflated: new Uint8Array([1, 2, 3]),
      dataRaw: new Uint8Array([4, 5, 6])
    })
    const document = readFigContainer(bytes, { fileName: 'fixture.fig' })

    expect(document.schemaDeflated).toEqual(new Uint8Array([1, 2, 3]))
    expect(document.dataRaw).toEqual(new Uint8Array([4, 5, 6]))
    expect(document.source?.bytes).toBe(bytes)
    expect(document.source?.fileName).toBe('fixture.fig')
  })

  it('parses complete .fig archives and image resources', () => {
    const thumbnailPNG = new Uint8Array([1])
    const metaJSON = '{}'
    const bytes = writeFigArchive({
      schemaDeflated: deflateSync(getSchemaBytes()),
      kiwiData: encodeMessage(
        createNodeChangesMessage(0, 0, [
          {
            guid: { sessionID: 0, localID: 0 },
            type: 'DOCUMENT',
            phase: 'CREATED',
            name: 'Document'
          }
        ])
      ),
      thumbnailPNG,
      metaJSON,
      images: [{ name: 'images/hash', data: new Uint8Array([9, 8, 7]) }]
    })
    const parsed = parseFigBuffer(bytes.buffer as ArrayBuffer)

    expect(parsed.nodeChanges).toHaveLength(1)
    expect(parsed.nodeChanges[0]?.type).toBe('DOCUMENT')
    expect(parsed.images).toEqual([['hash', new Uint8Array([9, 8, 7])]])
    expect(parsed.thumbnailPNG).toEqual(thumbnailPNG)
    expect(parsed.metaJSON).toBe(metaJSON)
  })

  it('rejects invalid fig-kiwi containers', () => {
    expect(() => readFigContainer(new Uint8Array([1, 2, 3]))).toThrow('Invalid fig-kiwi')
  })

  it('directs consumers to core for SceneGraph read/write', () => {
    expect(() => assertFigPackageReady()).toThrow('archive/container APIs')
  })
})
