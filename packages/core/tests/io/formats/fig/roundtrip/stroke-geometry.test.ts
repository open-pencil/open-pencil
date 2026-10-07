import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'

import { collectAllNodes } from '#core-tests/helpers/fig/traversal'

setDefaultTimeout(60_000)

describe('roundtrip: stroke geometry without strokes', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test('a weight and alignment kept without strokes survive export and re-import', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.createNode('RECTANGLE', page.id, {
      name: 'Kept',
      strokes: [],
      strokeWeight: 5,
      strokeAlign: 'OUTSIDE'
    })
    graph.createNode('RECTANGLE', page.id, { name: 'Default', strokes: [] })

    const bytes = await exportFigFile(graph)
    const nodes = collectAllNodes(await parseFigFile(bytes.buffer as ArrayBuffer))
    const kept = nodes.find((node) => node.name === 'Kept')
    expect([kept?.strokeWeight, kept?.strokeAlign]).toEqual([5, 'OUTSIDE'])
    const plain = nodes.find((node) => node.name === 'Default')
    expect([plain?.strokeWeight, plain?.strokeAlign]).toEqual([1, 'INSIDE'])
  })
})
