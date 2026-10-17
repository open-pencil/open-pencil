import { describe, expect, test } from 'bun:test'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { computeImageHash } from '@open-pencil/scene-graph'

const io = new IORegistry(BUILTIN_IO_FORMATS)

/** A tiny but real PNG signature, so the reader has bytes to name. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 8, 9])

const DOC = JSON.stringify({
  version: '2.8',
  children: [
    {
      type: 'frame',
      id: 'f1',
      name: 'Hero',
      width: 100,
      height: 100,
      fill: { type: 'image', enabled: true, url: 'assets/hero.png', mode: 'fit' }
    }
  ]
})

function penBytes(json: string): Uint8Array {
  return new TextEncoder().encode(json)
}

function hero(graph: Awaited<ReturnType<typeof io.readDocument>>['graph']) {
  // A page takes the name of the document's first child, so it can shadow the node under test.
  return [...graph.getAllNodes()].find((node) => node.name === 'Hero' && node.type !== 'CANVAS')
}

describe('reading a .pen document whose fills reference image assets', () => {
  test('reads the asset through the IO context and keeps its bytes', async () => {
    const { graph } = await io.readDocument(
      { name: 'doc.pen', data: penBytes(DOC) },
      { resolveAsset: (path) => (path === 'assets/hero.png' ? PNG : undefined) }
    )

    expect(graph.images.get(computeImageHash(PNG))).toEqual(PNG)
  })

  test('names the image fill with that hash', async () => {
    const { graph } = await io.readDocument(
      { name: 'doc.pen', data: penBytes(DOC) },
      { resolveAsset: () => PNG }
    )

    expect(hero(graph)?.fills[0]?.imageHash).toBe(computeImageHash(PNG))
  })

  test('opens with the reference unresolved when the caller supplies no resolver', async () => {
    const { graph } = await io.readDocument({
      name: 'doc.pen',
      data: penBytes(DOC)
    })

    expect(hero(graph)?.fills[0]?.type).toBe('IMAGE')
    expect(hero(graph)?.fills[0]?.imageHash).toBeUndefined()
  })
})
