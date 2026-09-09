import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { createFigDocumentSession } from '@open-pencil/fig'
import { SceneGraph, recordInstanceOverride } from '@open-pencil/scene-graph'

test('a deleted source node stays deleted across resume and remains undoable', async () => {
  await initCodec()
  const source = new SceneGraph()
  source.createNode('RECTANGLE', source.getPages()[0].id, { name: 'Delete me' })
  source.createNode('RECTANGLE', source.addPage('Second').id, { name: 'Other' })
  const bytes = await exportFigFile(source)
  const session = createFigDocumentSession(bytes.buffer as ArrayBuffer)
  session.loadPage(session.pages[0].id)
  const graph = session.graph
  const editor = createEditor({ graph })
  const node = [...graph.getAllNodes()].find((node) => node.name === 'Delete me')
  if (!node) throw new Error('Missing source node')
  const checkpoint = session.checkpoint()
  editor.select([node.id])
  editor.deleteSelected()
  expect(graph.getNode(node.id)).toBeUndefined()
  const resumed = createFigDocumentSession(bytes.buffer as ArrayBuffer, {}, { graph, checkpoint })
  resumed.loadPage(resumed.pages[1].id)
  expect(graph.getNode(node.id)).toBeUndefined()
  editor.undo.undo()
  expect(graph.getNode(node.id)?.name).toBe('Delete me')
  editor.undo.redo()
  expect(graph.getNode(node.id)).toBeUndefined()
})

test('later page instances inherit edits to an already loaded component', async () => {
  await initCodec()
  const source = new SceneGraph()
  const first = source.getPages()[0]
  const second = source.addPage('Second')
  const component = source.createNode('COMPONENT', first.id, { name: 'Shared' })
  source.createNode('TEXT', component.id, { text: 'Original' })
  source.createInstance(component.id, first.id)
  source.createInstance(component.id, second.id)
  const overridden = source.createInstance(component.id, second.id)
  if (!overridden) throw new Error('Missing overridden instance')
  const overriddenText = source.getChildren(overridden.id)[0]
  source.updateNode(overriddenText.id, { text: 'Explicit' })
  recordInstanceOverride(source, overriddenText.id, ['text'])
  const bytes = await exportFigFile(source)
  const session = createFigDocumentSession(bytes.buffer as ArrayBuffer)
  session.loadPage(session.pages[0].id)
  const graph = session.graph
  const liveComponent = [...graph.getAllNodes()].find((node) => node.type === 'COMPONENT')
  if (!liveComponent) throw new Error('Missing component')
  const label = graph.getChildren(liveComponent.id)[0]
  graph.updateNode(liveComponent.id, { opacity: 0.4 })
  graph.updateNode(label.id, { text: 'Component edit' })
  graph.syncInstances(liveComponent.id)
  const checkpointBeforeSecondPage = session.checkpoint()
  session.loadPage(session.pages[1].id)
  const pageId = session.graphPageId(session.pages[1].id)
  if (!pageId) throw new Error('Missing page')
  const instance = graph.getChildren(pageId).find((node) => node.type === 'INSTANCE')
  if (!instance) throw new Error('Missing instance')
  expect(instance.opacity).toBe(0.4)
  expect(graph.getChildren(instance.id)[0].text).toBe('Component edit')
  expect(
    graph
      .getChildren(pageId)
      .filter((node) => node.type === 'INSTANCE')
      .map((node) => graph.getChildren(node.id)[0].text)
  ).toEqual(['Component edit', 'Explicit'])
  const beforeFailure = graph.nodes.size
  graph.createNode('RECTANGLE', liveComponent.id, { name: 'Added child' })
  const retry = createFigDocumentSession(
    bytes.buffer as ArrayBuffer,
    {},
    { graph, checkpoint: checkpointBeforeSecondPage }
  )
  expect(() => retry.loadPage(session.pages[1].id)).toThrow('structural reconciliation')
  expect(graph.nodes.size).toBe(beforeFailure + 1)
})

test('loading a destination page preserves an existing reparented node', async () => {
  await initCodec()
  const source = new SceneGraph()
  source.createNode('RECTANGLE', source.getPages()[0].id, { name: 'Moved' })
  source.createNode('RECTANGLE', source.addPage('Second').id, { name: 'Other' })
  const bytes = await exportFigFile(source)
  const session = createFigDocumentSession(bytes.buffer as ArrayBuffer)
  session.loadPage(session.pages[0].id)
  const graph = session.graph
  const node = [...graph.getAllNodes()].find((node) => node.name === 'Moved')
  const destination = session.graphPageId(session.pages[1].id)
  if (!node || !destination) throw new Error('Missing nodes')
  graph.reparentNode(node.id, destination)
  session.loadPage(session.pages[1].id)
  expect(graph.getNode(node.id)).toBe(node)
  expect(node.parentId).toBe(destination)
  expect(graph.getChildren(destination).filter((child) => child.id === node.id)).toHaveLength(1)
})

for (const resume of [false, true]) {
  test(`page loading preserves editor undo/redo (resume=${resume})`, async () => {
    await initCodec()
    const source = new SceneGraph()
    const firstPage = source.getPages()[0]
    const secondPage = source.addPage('Second')
    const component = source.createNode('COMPONENT', secondPage.id, {
      name: 'Card',
      componentPropertyDefinitions: [
        { id: '10:1', name: 'Shown', type: 'BOOLEAN', defaultValue: 'true' }
      ]
    })
    source.createNode('RECTANGLE', component.id, {
      name: 'Target',
      componentPropertyReferences: [{ propertyId: '10:1', field: 'VISIBLE' }]
    })
    source.createInstance(component.id, firstPage.id)
    source.createInstance(component.id, secondPage.id)
    const bytes = await exportFigFile(source)
    let session = createFigDocumentSession(bytes.buffer as ArrayBuffer)
    session.loadPage(session.pages[0].id)
    const graph = session.graph
    const editor = createEditor({ graph })
    const pageId = session.graphPageId(session.pages[0].id)
    if (!pageId) throw new Error('Missing page')
    const instance = graph.getChildren(pageId).find((node) => node.type === 'INSTANCE')
    if (!instance) throw new Error('Missing instance')
    const target = graph.getChildren(instance.id)[0]
    editor.setInstanceComponentProperty(instance.id, '10:1', 'false')
    expect(target.visible).toBe(false)
    editor.undo.undo()
    expect(target.visible).toBe(true)
    if (resume)
      session = createFigDocumentSession(
        bytes.buffer as ArrayBuffer,
        {},
        { graph, checkpoint: session.checkpoint() }
      )
    session.loadPage(session.pages[1].id)
    expect(editor.graph).toBe(graph)
    expect(graph.getNode(target.id)).toBe(target)
    editor.undo.redo()
    expect(target.visible).toBe(false)
    editor.undo.undo()
    expect(target.visible).toBe(true)
    const secondId = session.graphPageId(session.pages[1].id)
    if (!secondId) throw new Error('Missing second page')
    const second = graph.getChildren(secondId).find((node) => node.type === 'INSTANCE')
    if (!second) throw new Error('Missing second instance')
    expect(graph.getChildren(second.id)[0].visible).toBe(true)
  })
}
