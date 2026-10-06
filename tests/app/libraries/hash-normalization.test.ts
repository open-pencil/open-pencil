import { describe, expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile } from '@open-pencil/core'
import { createLibraryRevision, discoverPublishableLibraryChanges } from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'

function source() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const component = graph.createNode('COMPONENT', page.id, {
    name: 'Button',
    componentKey: 'button',
    width: 80,
    height: 32
  })
  graph.createNode('TEXT', component.id, { name: 'Label', text: 'Button', width: 60, height: 20 })
  return graph
}

describe('library hash normalization', () => {
  test('ignores representation-only FIG round-trip changes', async () => {
    initCodec()
    const graph = source()
    const previous = await createLibraryRevision({ libraryId: 'library', name: 'Library', graph })
    const restored = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    const discovery = await discoverPublishableLibraryChanges(previous, restored)
    expect(discovery.changes).toEqual([])
  })

  test('still detects semantic changes after a FIG round trip', async () => {
    initCodec()
    const graph = source()
    const previous = await createLibraryRevision({ libraryId: 'library', name: 'Library', graph })
    const restored = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    const component = [...restored.getAllNodes()].find((node) => node.componentKey === 'button')
    if (!component) throw new Error('Component missing')
    restored.updateNode(component.id, { width: 144 })
    const discovery = await discoverPublishableLibraryChanges(previous, restored)
    expect(discovery.changes).toMatchObject([{ kind: 'modified', asset: { key: 'button' } }])
  })
})
