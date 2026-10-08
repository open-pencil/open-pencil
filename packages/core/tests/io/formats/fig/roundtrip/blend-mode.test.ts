import { beforeAll, describe, expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'
import { populateFigPage } from '@open-pencil/core/io/formats/fig'

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
})
