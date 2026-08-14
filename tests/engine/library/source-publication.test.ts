import { describe, expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile } from '@open-pencil/core'
import {
  readSourceLibraryPublication,
  writeSourceLibraryPublication
} from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'

describe('source library publication identity', () => {
  test('survives a FIG export and reimport', async () => {
    initCodec()
    const graph = new SceneGraph()
    writeSourceLibraryPublication(graph, {
      libraryId: 'design-system',
      revisionId: 'revision-1',
      name: 'Design system',
      catalogSource: 'local'
    })
    const restored = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    expect(readSourceLibraryPublication(restored)).toEqual({
      libraryId: 'design-system',
      revisionId: 'revision-1',
      name: 'Design system',
      catalogSource: 'local'
    })
  })

  test('round-trips through root plugin data', () => {
    const graph = new SceneGraph()
    expect(readSourceLibraryPublication(graph)).toBeNull()
    writeSourceLibraryPublication(graph, {
      libraryId: 'design-system',
      revisionId: 'revision-1',
      name: 'Design system',
      catalogSource: 'local'
    })
    expect(readSourceLibraryPublication(graph)).toEqual({
      libraryId: 'design-system',
      revisionId: 'revision-1',
      name: 'Design system',
      catalogSource: 'local'
    })
  })

  test('ignores malformed metadata', () => {
    const graph = new SceneGraph()
    const root = graph.getNode(graph.rootId)
    if (!root) throw new Error('Root missing')
    graph.updateNode(root.id, {
      pluginData: [{ pluginId: 'open-pencil', key: 'sourceLibraryPublication', value: '{}' }]
    })
    expect(readSourceLibraryPublication(graph)).toBeNull()
  })
})
