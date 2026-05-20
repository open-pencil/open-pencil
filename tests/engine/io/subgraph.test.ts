import { describe, expect, test } from 'bun:test'

import { exportFigFile, extractExportGraph, parseFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { SceneGraph } from '@open-pencil/core/scene-graph'

describe('export subgraph extraction', () => {
  test('page extraction keeps the source root and page descendants', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      name: 'Frame',
      x: 10,
      y: 20,
      width: 100,
      height: 100
    })
    const text = graph.createNode('TEXT', frame.id, {
      name: 'Label',
      text: 'Hello',
      width: 50,
      height: 20
    })

    const extracted = extractExportGraph(graph, { scope: 'page', pageId: page.id })
    const extractedPages = extracted.graph.getPages(true)

    expect(extracted.graph.rootId).toBe(graph.rootId)
    expect(extractedPages.map((node) => node.id)).toEqual([page.id])
    expect(extracted.graph.getNode(page.id)?.childIds).toEqual([frame.id])
    expect(extracted.graph.getNode(frame.id)?.childIds).toEqual([text.id])
    expect(extracted.graph.getNode(text.id)?.text).toBe('Hello')
  })

  test('page extraction includes component dependencies for instances', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const libraryPage = graph.addPage('Library')
    const component = graph.createNode('COMPONENT', libraryPage.id, {
      name: 'Button',
      width: 100,
      height: 40
    })
    graph.createNode('TEXT', component.id, {
      name: 'Label',
      text: 'Button',
      width: 80,
      height: 20
    })
    const instance = graph.createInstance(component.id, page.id)

    const extracted = extractExportGraph(graph, { scope: 'page', pageId: page.id })

    expect(extracted.graph.getNode(instance.id)?.type).toBe('INSTANCE')
    expect(extracted.graph.getNode(component.id)?.type).toBe('COMPONENT')
    expect(extracted.graph.getNode(libraryPage.id)?.type).toBe('CANVAS')
  })

  test('fig page export preserves valid instance component references', async () => {
    await initCodec()
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const libraryPage = graph.addPage('Library')
    const component = graph.createNode('COMPONENT', libraryPage.id, {
      name: 'Button',
      width: 100,
      height: 40
    })
    const instance = graph.createInstance(component.id, page.id)
    if (!instance) throw new Error('Expected instance')

    const extracted = extractExportGraph(graph, { scope: 'page', pageId: page.id })
    const exported = await exportFigFile(extracted.graph)
    const parsed = await parseFigFile(exported.buffer as ArrayBuffer)
    const parsedInstance = [...parsed.getAllNodes()].find(
      (node) => node.type === 'INSTANCE' && node.name === instance.name
    )

    expect(parsedInstance?.type).toBe('INSTANCE')
    expect(parsedInstance?.componentId).toBeTruthy()
    expect(parsed.getNode(parsedInstance?.componentId ?? '')?.type).toBe('COMPONENT')
  })
})
