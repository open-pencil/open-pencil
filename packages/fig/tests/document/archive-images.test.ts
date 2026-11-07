import { expect, spyOn, test } from 'bun:test'

import * as archiveModule from '#fig/archive'
import { writeFigArchive } from '#fig/archive'
import { createFigDocumentSession, materializeFigArchive } from '#fig/document/materialize'
import { deflateSync } from 'fflate'

import {
  createNodeChangesMessage,
  encodeMessage,
  getSchemaBytes,
  initCodec
} from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph } from '@open-pencil/scene-graph'

const IMAGE_BYTES = 256 * 1024
const IMAGE_COUNT = 4

function generatedImage(seed: number): Uint8Array {
  const bytes = new Uint8Array(IMAGE_BYTES)
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = (index * 31 + seed) & 0xff
  }
  return bytes
}

const images = Array.from({ length: IMAGE_COUNT }, (_, seed) => ({
  name: `images/${seed.toString(16).padStart(40, '0')}`,
  data: generatedImage(seed)
}))

async function archiveWithImages(): Promise<ArrayBuffer> {
  await initCodec()
  const archive = writeFigArchive({
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
    thumbnailPNG: new Uint8Array(),
    metaJSON: '{}',
    images
  })
  return new Uint8Array(archive).buffer
}

function imageCopies(slicedFrom: readonly unknown[]): number {
  return slicedFrom.filter(
    (source) => source instanceof Uint8Array && source.byteLength === IMAGE_BYTES
  ).length
}

function openCountingImageCopies(open: (bytes: ArrayBuffer) => SceneGraph, bytes: ArrayBuffer) {
  const parseFigBuffer = archiveModule.parseFigBuffer
  const unzipped = new Map<string, Uint8Array>()
  const parse = spyOn(archiveModule, 'parseFigBuffer').mockImplementation((...args) => {
    const parsed = parseFigBuffer(...args)
    for (const [hash, data] of parsed.images) {
      unzipped.set(hash, data)
    }
    return parsed
  })
  const slice = spyOn(Uint8Array.prototype, 'slice')
  try {
    const graph = open(bytes)
    return { graph, unzipped, copies: imageCopies(slice.mock.contexts) }
  } finally {
    slice.mockRestore()
    parse.mockRestore()
  }
}

test.each([
  ['a session', (bytes: ArrayBuffer) => createFigDocumentSession(bytes).graph],
  ['a whole-archive read', (bytes: ArrayBuffer) => materializeFigArchive(bytes).graph]
])('%s keeps the images it unzipped without copying them again', async (_, open) => {
  const bytes = await archiveWithImages()
  const { graph, unzipped, copies } = openCountingImageCopies(open, bytes)

  expect(copies).toBe(0)
  for (const { name, data } of images) {
    const hash = name.slice('images/'.length)
    const image = graph.images.get(hash)
    expect(image).toEqual(data)
    expect(image?.buffer).toBe(unzipped.get(hash)?.buffer)
    expect(image?.byteLength).toBe(image?.buffer.byteLength)
  }
})

test.each([
  [
    'a session',
    (bytes: ArrayBuffer, given: ReadonlyMap<string, Uint8Array>) =>
      createFigDocumentSession(bytes, { images: given }).graph
  ],
  [
    'a whole-archive read',
    (bytes: ArrayBuffer, given: ReadonlyMap<string, Uint8Array>) =>
      materializeFigArchive(bytes, { images: given }).graph
  ]
])('%s copies the images a caller hands in', async (_, open) => {
  const bytes = await archiveWithImages()
  const given = new Map([['caller', generatedImage(IMAGE_COUNT)]])

  const graph = open(bytes, given)
  const kept = graph.images.get('caller')

  expect(kept).toEqual(given.get('caller'))
  expect(kept?.buffer).not.toBe(given.get('caller')?.buffer)
  for (const { name } of images) {
    expect(graph.images.has(name.slice('images/'.length))).toBe(false)
  }
})
