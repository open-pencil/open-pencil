import { beforeAll, describe, expect, it } from 'bun:test'

import { expectDefined } from '#fig-tests/helpers/assert'
import {
  FIG_PACKAGE_STATUS,
  figArchiveKind,
  figArchiveMetaJSON,
  parseFigBuffer,
  readFigArchiveMeta,
  readFigContainer,
  renameFigArchive,
  writeFigArchive,
  writeFigContainer
} from '#fig/index'
import { deflateSync } from 'fflate'
import { toUint8Array } from 'js-base64'

import {
  createNodeChangesMessage,
  encodeMessage,
  getSchemaBytes,
  initCodec
} from '@open-pencil/kiwi/fig/codec'

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
/** A 3 × 2 PNG, as a `.fig` thumbnail chunk holds one. */
const PNG_3X2 =
  'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAEElEQVR4nGP4z8AAQQxwFgBB0gX7h/C5SAAAAABJRU5ErkJggg=='

function appendChunk(container: Uint8Array, chunk: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(container.byteLength + 4 + chunk.byteLength)
  bytes.set(container)
  new DataView(bytes.buffer).setUint32(container.byteLength, chunk.byteLength, true)
  bytes.set(chunk, container.byteLength + 4)
  return bytes
}

describe('@open-pencil/fig package API', () => {
  beforeAll(async () => {
    await initCodec()
  })

  it('exports archive API status', () => {
    expect(FIG_PACKAGE_STATUS).toBe('document-reader')
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

  it('writes meta.json as Figma does', () => {
    // Recorded from Figma's "Save local copy…" of a one-rectangle page with a #1E1E1E background.
    const figmaMetaJSON =
      '{"client_meta":{"background_color":{"r":0.11764705926179886,"g":0.11764705926179886,' +
      '"b":0.11764705926179886,"a":1},"thumbnail_size":{"width":400,"height":357},' +
      '"render_coordinates":{"x":49,"y":3,"width":345,"height":308}},' +
      '"file_name":"OP-capture-test","developer_related_links":[],' +
      '"exported_at":"2026-10-13T06:25:07.134Z"}'
    const gray = 30 / 255

    expect(
      figArchiveMetaJSON({
        fileName: 'OP-capture-test',
        backgroundColor: { r: gray, g: gray, b: gray, a: 1 },
        thumbnailSize: { width: 400, height: 357 },
        renderCoordinates: { x: 49, y: 3, width: 345, height: 308 },
        exportedAt: new Date('2026-10-13T06:25:07.134Z')
      })
    ).toBe(figmaMetaJSON)
    expect(readFigArchiveMeta(figmaMetaJSON).success).toBe(true)
    expect(readFigArchiveMeta('{"version":1,"app":"OpenPencil"}').success).toBe(false)
  })

  it('renames an archive in its meta.json and keeps keys it does not know', () => {
    const archive = (metaJSON: string) =>
      writeFigArchive({
        schemaDeflated: deflateSync(getSchemaBytes()),
        kiwiData: encodeMessage(
          createNodeChangesMessage(0, 0, [
            { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', phase: 'CREATED' }
          ])
        ),
        thumbnailPNG: PNG_SIGNATURE,
        metaJSON,
        images: [{ name: 'images/hash', data: new Uint8Array([9, 8, 7]) }]
      })
    const bytes = archive('{"client_meta":{"later_field":1},"file_name":"Old","extra":true}')
    const renamed = parseFigBuffer(
      expectDefined(renameFigArchive(bytes, 'New'), 'renamed archive').slice().buffer
    )

    expect(renamed.metaJSON).toBe(
      '{"client_meta":{"later_field":1},"file_name":"New","extra":true}'
    )
    expect(renamed.images).toEqual([['hash', new Uint8Array([9, 8, 7])]])
    expect(renameFigArchive(bytes, 'Old')).toBe(bytes)
    expect(renameFigArchive(archive('{"version":1,"app":"OpenPencil"}'), 'New')).toBeNull()
  })

  it('tells a board archive from a design one by its canvas header', () => {
    const archive = (kind?: 'design' | 'board') =>
      writeFigArchive({
        schemaDeflated: deflateSync(getSchemaBytes()),
        kiwiData: encodeMessage(createNodeChangesMessage(0, 0, [])),
        thumbnailPNG: PNG_SIGNATURE,
        metaJSON: '{}',
        kind
      })

    expect(figArchiveKind(archive())).toBe('design')
    expect(figArchiveKind(archive('board'))).toBe('board')
    expect(figArchiveKind(new TextEncoder().encode('fig-jam.'))).toBe('board')
    expect(figArchiveKind(new Uint8Array([1, 2, 3]))).toBeNull()
  })

  it('parses legacy raw fig-kiwi files and preserves their thumbnail chunk', () => {
    const container = writeFigContainer(
      {
        schemaDeflated: deflateSync(getSchemaBytes()),
        dataRaw: encodeMessage(
          createNodeChangesMessage(0, 0, [
            {
              guid: { sessionID: 0, localID: 0 },
              type: 'DOCUMENT',
              phase: 'CREATED',
              name: 'Document'
            }
          ])
        )
      },
      { version: 1 }
    )
    const thumbnailPNG = toUint8Array(PNG_3X2)
    const bytes = appendChunk(container, thumbnailPNG)
    const parsed = parseFigBuffer(bytes.buffer as ArrayBuffer)

    expect(parsed.nodeChanges).toHaveLength(1)
    expect(parsed.figKiwiVersion).toBe(1)
    expect(parsed.images).toEqual([])
    expect(parsed.thumbnailPNG).toEqual(thumbnailPNG)
    expect(parsed.metaJSON).toBeNull()
  })

  it('rejects invalid fig-kiwi containers', () => {
    expect(() => readFigContainer(new Uint8Array([1, 2, 3]))).toThrow('Invalid fig-kiwi')
  })
})
