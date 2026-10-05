import { beforeAll, describe, expect, test } from 'bun:test'

import { exportFigFile, initCodec } from '@open-pencil/core'
import { parseFigBuffer } from '@open-pencil/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

import { sceneNodeToKiwi } from '#core/kiwi/fig/node-change/serialize'

import { uint8ArrayToArrayBuffer } from '#tests/helpers/fig/fixtures'

function serialize(graph: SceneGraph, nodeId: string) {
  const node = graph.getNode(nodeId)
  if (!node) throw new Error('Expected scene node')
  return sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 20 }, graph, [])[0]
}

describe('Figma shared style export', () => {
  beforeAll(async () => {
    await initCodec()
  })
  test('exports every modeled style reference and promoted layout grids', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('FRAME', page.id, {
      fillStyleId: '1:10',
      strokeStyleId: '1:11',
      textStyleId: '1:12',
      effectStyleId: '1:13',
      gridStyleId: '1:14',
      layoutGrids: [{ pattern: 'COLUMNS', count: 12, gutterSize: 16, visible: true }]
    })

    expect(serialize(graph, node.id)).toMatchObject({
      styleIdForFill: { guid: { sessionID: 1, localID: 10 } },
      styleIdForStrokeFill: { guid: { sessionID: 1, localID: 11 } },
      styleIdForText: { guid: { sessionID: 1, localID: 12 } },
      styleIdForEffect: { guid: { sessionID: 1, localID: 13 } },
      styleIdForGrid: { guid: { sessionID: 1, localID: 14 } },
      layoutGrids: [{ pattern: 'COLUMNS', count: 12, gutterSize: 16, visible: true }]
    })
  })

  test('exports internal style definitions with their style type', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const style = graph.createNode('RECTANGLE', page.id, {
      name: 'Brand/Primary',
      sharedStyleType: 'FILL',
      internalOnly: true
    })
    style.source.id = '1:10'

    expect(serialize(graph, style.id)).toMatchObject({
      guid: { sessionID: 1, localID: 10 },
      name: 'Brand/Primary',
      styleType: 'FILL'
    })
  })

  test('includes referenced definitions in a complete .fig export', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const style = graph.createNode('RECTANGLE', page.id, {
      name: 'Brand/Primary',
      sharedStyleType: 'FILL',
      internalOnly: true
    })
    style.source.id = '1:10'
    graph.createNode('RECTANGLE', page.id, { name: 'Styled target', fillStyleId: '1:10' })

    const bytes = await exportFigFile(graph)
    const parsed = parseFigBuffer(uint8ArrayToArrayBuffer(bytes))
    const definition = parsed.nodeChanges.find((change) => change.styleType === 'FILL')
    const target = parsed.nodeChanges.find((change) => change.name === 'Styled target')

    expect(definition).toMatchObject({ name: 'Brand/Primary', styleType: 'FILL' })
    expect(target?.styleIdForFill).toEqual({ guid: { sessionID: 1, localID: 10 } })
  })
})
