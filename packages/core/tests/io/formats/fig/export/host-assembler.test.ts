import { afterEach, expect, test } from 'bun:test'

import {
  exportFigFile,
  setFigArchiveAssembler,
  type FigArchiveParts
} from '@open-pencil/core/io/formats/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

afterEach(() => setFigArchiveAssembler(null))

test('a host assembler packs the archive from the parts the export prepared', async () => {
  const graph = new SceneGraph()
  graph.documentKind = 'board'
  graph.createNode('RECTANGLE', graph.getPages()[0].id, { name: 'Card', width: 40, height: 20 })
  const received: FigArchiveParts[] = []
  const packed = new Uint8Array([1, 2, 3])
  setFigArchiveAssembler(async (parts) => {
    received.push(parts)
    return packed
  })

  expect(await exportFigFile(graph, { documentName: 'Board' })).toBe(packed)
  expect(received).toHaveLength(1)
  const [parts] = received
  expect(parts.documentKind).toBe('board')
  expect(parts.kiwiData.length).toBeGreaterThan(0)
  expect(parts.schemaDeflated.length).toBeGreaterThan(0)
  expect(JSON.parse(parts.metaJSON)).toMatchObject({ file_name: 'Board' })
})

test('without a host assembler the export packs the archive itself', async () => {
  const graph = new SceneGraph()
  const bytes = await exportFigFile(graph)
  // A `.fig` is a ZIP archive.
  expect(Array.from(bytes.subarray(0, 2))).toEqual([0x50, 0x4b])
})
