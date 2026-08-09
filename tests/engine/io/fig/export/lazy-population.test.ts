import { describe, expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile } from '@open-pencil/core'
import { setLazyFigImportContext } from '@open-pencil/core/kiwi/fig/lazy-import'
import { SceneGraph } from '@open-pencil/scene-graph'

function lazyExportGraph() {
  const graph = new SceneGraph()
  const firstPage = graph.getPages()[0]
  const secondPage = graph.addPage('Second')
  const component = graph.createNode('COMPONENT', firstPage.id, { name: 'Button' })
  graph.createNode('TEXT', component.id, { text: 'Label' })
  const instance = graph.createNode('INSTANCE', secondPage.id, {
    name: 'Button instance',
    componentId: component.id
  })
  setLazyFigImportContext(graph, {
    changeMap: new Map(),
    guidToNodeId: new Map(),
    blobs: [],
    populatedRootIds: new Set([firstPage.id])
  })
  return { graph, secondPage, instance }
}

describe('FIG population export lifecycle', () => {
  test('exports all remaining lazy pages after a partial visit', async () => {
    await initCodec()
    const { graph, instance } = lazyExportGraph()
    expect(graph.getChildren(instance.id)).toHaveLength(0)

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer, { populate: 'all' })
    const reimportedInstance = [...reimported.getAllNodes()].find(
      (node) => node.type === 'INSTANCE' && node.name === 'Button instance'
    )
    expect(reimportedInstance).toBeDefined()
    expect(reimported.getChildren(reimportedInstance?.id ?? '')).toHaveLength(1)
  })
})
