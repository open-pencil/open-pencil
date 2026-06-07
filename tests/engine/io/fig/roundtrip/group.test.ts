import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'

import { collectAllNodes } from '#tests/helpers/fig-traversal'

setDefaultTimeout(60_000)

describe('roundtrip: GROUP survives export → re-import', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test('a GROUP exported to .fig re-imports as a GROUP', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const group = graph.createNode('GROUP', page.id, {
      name: 'My Group',
      x: 0,
      y: 0,
      width: 100,
      height: 100
    })
    graph.createNode('RECTANGLE', group.id, {
      name: 'child',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })

    const bytes = await exportFigFile(graph)
    const reImported = await parseFigFile(bytes)
    const nodes = collectAllNodes(reImported)

    const roundTripped = nodes.find((n) => n.name === 'My Group')
    expect(roundTripped?.type).toBe('GROUP')
  })
})
