import { describe, expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile } from '@open-pencil/core'
import {
  getLazyFigImportContext,
  setLazyFigImportContext
} from '@open-pencil/core/kiwi/fig/lazy-import'
import { cloneSceneGraphForFigExport } from '@open-pencil/core/kiwi/fig/parse/transfer'
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

function createEditedInstance(
  graph: SceneGraph,
  componentId: string,
  parentId: string,
  name: string,
  text: string
) {
  const instance = graph.createInstance(componentId, parentId, { name })
  if (!instance) throw new Error(`Could not create instance: ${name}`)
  const textId = instance.childIds[0]
  graph.updateNode(textId, { text })
  graph.updateNode(instance.id, { overrides: { [`${textId}:text`]: text } })
  return { instance, textId }
}

describe('FIG population export lifecycle', () => {
  test('isolates mutable graph state while sharing immutable binary resources', () => {
    const { graph } = lazyExportGraph()
    const image = new Uint8Array([1, 2, 3])
    graph.images.set('image', image)
    const context = getLazyFigImportContext(graph)
    expect(context).toBeDefined()

    const clone = cloneSceneGraphForFigExport(graph)
    const cloneContext = getLazyFigImportContext(clone)
    const firstPage = graph.getPages()[0]
    clone.getNode(firstPage.id)?.childIds.push('export-only')
    cloneContext?.populatedRootIds.add('export-only')

    expect(graph.getNode(firstPage.id)?.childIds).not.toContain('export-only')
    expect(context?.populatedRootIds).not.toContain('export-only')
    expect(clone.images.get('image')).toBe(image)
    expect(cloneContext?.changeMap).toBe(context?.changeMap)
    expect(cloneContext?.guidToNodeId).toBe(context?.guidToNodeId)
    expect(cloneContext?.blobs).toBe(context?.blobs)
  })

  test('exports all remaining lazy pages after a partial visit', async () => {
    await initCodec()
    const { graph, instance } = lazyExportGraph()
    expect(graph.getChildren(instance.id)).toHaveLength(0)

    const exported = await exportFigFile(graph)
    expect(graph.getChildren(instance.id)).toHaveLength(0)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer, { populate: 'all' })
    const reimportedInstance = [...reimported.getAllNodes()].find(
      (node) => node.type === 'INSTANCE' && node.name === 'Button instance'
    )
    expect(reimportedInstance).toBeDefined()
    expect(reimported.getChildren(reimportedInstance?.id ?? '')).toHaveLength(1)
  })

  test('preserves edited instance text overrides without mutating the live graph', async () => {
    await initCodec()
    const { graph, secondPage } = lazyExportGraph()
    const firstPage = graph.getPages()[0]
    const component = [...graph.getAllNodes()].find(
      (node) => node.type === 'COMPONENT' && node.name === 'Button'
    )
    expect(component).toBeDefined()
    const partial = createEditedInstance(
      graph,
      component?.id ?? '',
      firstPage.id,
      'Partially edited instance',
      'Lab'
    )
    const empty = createEditedInstance(
      graph,
      component?.id ?? '',
      firstPage.id,
      'Empty edited instance',
      ''
    )

    const exported = await exportFigFile(graph)

    expect(graph.getNode(partial.textId)?.text).toBe('Lab')
    expect(graph.getNode(empty.textId)?.text).toBe('')
    expect(graph.getChildren(secondPage.id)[0]?.childIds).toHaveLength(0)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer, { populate: 'all' })
    const reimportedPartial = [...reimported.getAllNodes()].find(
      (node) => node.type === 'INSTANCE' && node.name === 'Partially edited instance'
    )
    const reimportedEmpty = [...reimported.getAllNodes()].find(
      (node) => node.type === 'INSTANCE' && node.name === 'Empty edited instance'
    )
    expect(reimportedPartial).toBeDefined()
    expect(reimportedEmpty).toBeDefined()
    expect(reimported.getChildren(reimportedPartial?.id ?? '')[0]?.text).toBe('Lab')
    expect(reimported.getChildren(reimportedEmpty?.id ?? '')[0]?.text).toBe('')
  })
})
