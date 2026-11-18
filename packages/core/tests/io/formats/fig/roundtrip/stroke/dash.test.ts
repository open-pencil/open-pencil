import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'
import { collectAllNodes } from '@open-pencil/test-support/fig/traversal'

setDefaultTimeout(60_000)

function nodeNamed(graph: SceneGraph, name: string): SceneNode {
  return expectDefined(
    collectAllNodes(graph).find((node) => node.name === name),
    `node ${name}`
  )
}

async function reImport(graph: SceneGraph): Promise<SceneGraph> {
  const bytes = await exportFigFile(graph)
  return parseFigFile(bytes.buffer as ArrayBuffer)
}

const BLUE = { r: 0, g: 0, b: 1, a: 1 }

describe('roundtrip: stroke dash', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test('a dash the stroke panel sets on a stroke survives export and re-import', async () => {
    const graph = new SceneGraph()
    graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      name: 'Dashed',
      width: 100,
      height: 100,
      strokes: [
        {
          type: 'SOLID',
          color: BLUE,
          opacity: 1,
          visible: true,
          weight: 2,
          align: 'INSIDE',
          dashPattern: [6, 4]
        }
      ]
    })

    const node = nodeNamed(await reImport(graph), 'Dashed')

    expect(node.dashPattern).toEqual([6, 4])
    expect(node.strokes[0]?.dashPattern).toEqual([6, 4])
  })

  test('a dash a layer keeps without strokes survives export and re-import', async () => {
    const graph = new SceneGraph()
    graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      name: 'Kept',
      width: 100,
      height: 100,
      strokes: [],
      dashPattern: [6, 4]
    })

    const node = nodeNamed(await reImport(graph), 'Kept')

    expect(node.dashPattern).toEqual([6, 4])
    expect(node.strokes).toEqual([])
  })

  test('a dash cleared from the stroke is not written by a layer pattern left behind', async () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      name: 'Cleared',
      width: 100,
      height: 100,
      strokes: [
        {
          type: 'SOLID',
          color: BLUE,
          opacity: 1,
          visible: true,
          weight: 2,
          align: 'INSIDE',
          dashPattern: []
        }
      ]
    })
    // A document saved before the layer followed its strokes can still hold the old pattern.
    node.dashPattern = [6, 4]

    const reimported = nodeNamed(await reImport(graph), 'Cleared')

    expect(reimported.dashPattern).toEqual([])
    expect(reimported.strokes[0]?.dashPattern).toEqual([])
  })
})
