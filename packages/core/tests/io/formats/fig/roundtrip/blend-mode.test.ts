import { beforeAll, describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile, populateFigPage } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

describe('roundtrip: layer blend modes', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test('a layer keeps its blend mode, and an unset one stays pass-through', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    for (const blendMode of ['MULTIPLY', 'SCREEN', 'PASS_THROUGH'] as const)
      graph.createNode('ELLIPSE', page.id, { name: blendMode, width: 80, height: 80, blendMode })

    const reImported = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    const [reImportedPage] = reImported.getPages()
    populateFigPage(reImported, reImportedPage.id)

    expect(reImported.getChildren(reImportedPage.id).map((node) => node.blendMode)).toEqual([
      'MULTIPLY',
      'SCREEN',
      'PASS_THROUGH'
    ])
  })

  test('plus darker and plus lighter survive on layers and paints', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    for (const blendMode of ['LINEAR_BURN', 'LINEAR_DODGE'] as const) {
      graph.createNode('RECTANGLE', page.id, {
        name: blendMode,
        width: 80,
        height: 80,
        blendMode,
        fills: [
          { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, blendMode }
        ],
        strokes: [
          {
            type: 'SOLID',
            color: { r: 0, g: 0, b: 1, a: 1 },
            opacity: 1,
            visible: true,
            weight: 2,
            align: 'INSIDE',
            blendMode
          }
        ]
      })
    }

    const reImported = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    const [reImportedPage] = reImported.getPages()
    populateFigPage(reImported, reImportedPage.id)

    const children = reImported.getChildren(reImportedPage.id)
    expect(children.map((node) => node.blendMode)).toEqual(['LINEAR_BURN', 'LINEAR_DODGE'])
    expect(children.map((node) => node.fills[0].blendMode)).toEqual(['LINEAR_BURN', 'LINEAR_DODGE'])
    expect(children.map((node) => node.strokes[0].blendMode)).toEqual([
      'LINEAR_BURN',
      'LINEAR_DODGE'
    ])
  })
})
