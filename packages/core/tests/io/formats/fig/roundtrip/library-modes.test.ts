import { describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

describe('a collection copied from a library', () => {
  test('saves which library mode each of its modes came from', async () => {
    await initCodec()
    const graph = new SceneGraph()
    graph.addCollection({
      id: '4:90',
      name: 'Theme',
      modes: [
        { modeId: '4:9', name: 'Light', libraryModeId: '0:1' },
        { modeId: '4:10', name: 'Night', libraryModeId: '0:2' }
      ],
      defaultModeId: '4:9',
      variableIds: []
    })

    const reimported = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    const collection = expectDefined(reimported.variableCollections.get('4:90'), 'theme copy')

    expect(collection.modes).toMatchObject([
      { modeId: '4:9', name: 'Light', libraryModeId: '0:1' },
      { modeId: '4:10', name: 'Night', libraryModeId: '0:2' }
    ])
    // Rebuilt on save, never duplicated into pass-through plugin data.
    expect(collection.pluginData).toBeUndefined()
  })
})
