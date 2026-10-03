import { expect, test } from 'bun:test'

import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { createFigDocumentSession, materializeFigArchive } from '@open-pencil/fig'
import { SceneGraph, CommittedGraphEventError } from '@open-pencil/scene-graph'

test('a mid-load creation failure leaves existing nodes and loaded pages unchanged', async () => {
  await initCodec()
  const source = new SceneGraph()
  source.createNode('TEXT', source.getPages()[0].id, { name: 'First' })
  source.createNode('TEXT', source.getPages()[0].id, { name: 'Second' })
  const bytes = await exportFigFile(source)
  const session = createFigDocumentSession(bytes.buffer as ArrayBuffer)
  const before = [...session.graph.getAllNodes()].map((node) => ({
    id: node.id,
    children: [...node.childIds]
  }))
  const created: string[] = []
  session.graph.onNodeEvents({ created: (node) => created.push(node.id) })
  const create = session.graph.createNode.bind(session.graph)
  let calls = 0
  session.graph.createNode = (...args) => {
    if (++calls === 2) throw new Error('Injected creation failure')
    return create(...args)
  }
  try {
    expect(() => session.loadPage(session.pages[0].id)).toThrow('Injected creation failure')
  } finally {
    session.graph.createNode = create
  }
  expect(
    [...session.graph.getAllNodes()].map((node) => ({ id: node.id, children: [...node.childIds] }))
  ).toEqual(before)
  expect(created).toEqual([])
  expect(session.loadedPageIds.size).toBe(0)
  session.loadPage(session.pages[0].id)
  expect([...session.graph.getAllNodes()].filter((node) => node.type === 'TEXT')).toHaveLength(2)
})

test('creation observers see committed pages and can load another page reentrantly', async () => {
  await initCodec()
  const source = new SceneGraph()
  source.createNode('TEXT', source.getPages()[0].id, { name: 'First' })
  source.createNode('TEXT', source.addPage('Second').id, { name: 'Second' })
  const bytes = await exportFigFile(source)
  const session = createFigDocumentSession(bytes.buffer as ArrayBuffer)
  let committed = false
  session.graph.onNodeEvents({
    created: (node) => {
      if (node.name !== 'First') return
      committed = session.loadedPageIds.has(session.pages[0].id)
      session.loadPage(session.pages[1].id)
    }
  })
  session.loadPage(session.pages[0].id)
  expect(committed).toBe(true)
  expect(session.loadedPageIds.size).toBe(2)
  expect([...session.graph.getAllNodes()].filter((node) => node.type === 'TEXT')).toHaveLength(2)
})

test('observer errors identify a committed load and retry does not duplicate nodes', async () => {
  await initCodec()
  const source = new SceneGraph()
  source.createNode('TEXT', source.getPages()[0].id, { name: 'Loaded' })
  const bytes = await exportFigFile(source)
  const session = createFigDocumentSession(bytes.buffer as ArrayBuffer)
  session.graph.onNodeEvents({
    created: () => {
      throw new Error('Observer failure')
    }
  })
  let error: unknown
  try {
    session.loadPage(session.pages[0].id)
  } catch (caught) {
    error = caught
  }
  expect(error).toBeInstanceOf(CommittedGraphEventError)
  if (!(error instanceof CommittedGraphEventError)) throw new Error('Expected committed error')
  expect(error.committed).toBe(true)
  expect(session.loadedPageIds.has(session.pages[0].id)).toBe(true)
  expect(() => session.loadPage(session.pages[0].id)).not.toThrow()
  expect([...session.graph.getAllNodes()].filter((node) => node.type === 'TEXT')).toHaveLength(1)
})

test('full and reverse-order incremental loads produce equivalent page trees', async () => {
  await initCodec()
  const source = new SceneGraph()
  const first = source.getPages()[0]
  const second = source.addPage('Components')
  const component = source.createNode('COMPONENT', second.id, { name: 'Shared' })
  source.createNode('TEXT', component.id, { text: 'Label' })
  source.createInstance(component.id, first.id)
  source.createNode('RECTANGLE', first.id, { name: 'Sibling', width: 80 })
  const bytes = await exportFigFile(source)
  const eager = materializeFigArchive(bytes.buffer as ArrayBuffer).graph
  const session = createFigDocumentSession(bytes.buffer as ArrayBuffer)
  for (const page of [...session.pages].reverse()) session.loadPage(page.id)
  const snapshot = (graph: SceneGraph) => {
    const rows: unknown[] = []
    const visit = (id: string, path: number[]): void => {
      const node = graph.getNode(id)
      if (!node) throw new Error('Missing node')
      rows.push({
        path,
        type: node.type,
        name: node.name,
        text: node.text,
        width: node.width,
        height: node.height,
        component: node.componentId ? graph.getNode(node.componentId)?.name : null
      })
      graph.getChildren(id).forEach((child, index) => visit(child.id, [...path, index]))
    }
    graph.getPages().forEach((page, index) => visit(page.id, [index]))
    return rows
  }
  expect(snapshot(session.graph)).toEqual(snapshot(eager))
  const before = snapshot(session.graph)
  expect(() => session.loadPage('missing')).toThrow('Unknown page')
  expect(snapshot(session.graph)).toEqual(before)
  expect(session.loadedPageIds.size).toBe(2)
})

test('loading another page preserves existing node identity and text edits', async () => {
  await initCodec()
  const graph = new SceneGraph()
  graph.createNode('TEXT', graph.getPages()[0].id, { name: 'First', text: 'Original' })
  const secondPage = graph.addPage('Second')
  graph.createNode('TEXT', secondPage.id, { name: 'Second', text: 'Second' })
  const component = graph.createNode('COMPONENT', secondPage.id, { name: 'Shared component' })
  graph.createNode('TEXT', component.id, { text: 'Default' })
  graph.createInstance(component.id, graph.getPages()[0].id)
  graph.createInstance(component.id, secondPage.id)
  const bytes = await exportFigFile(graph)
  const session = createFigDocumentSession(bytes.buffer as ArrayBuffer)
  expect([...session.graph.getAllNodes()].filter((n) => n.type === 'TEXT')).toHaveLength(0)
  session.loadPage(session.pages[0].id)
  const first = [...session.graph.getAllNodes()].find((n) => n.name === 'First')
  if (!first) throw new Error('Missing first node')
  session.graph.updateNode(first.id, { text: 'Edited' })
  const existingComponent = [...session.graph.getAllNodes()].find(
    (node) => node.type === 'COMPONENT'
  )
  if (!existingComponent) throw new Error('Missing dependency component')
  session.graph.updateNode(existingComponent.id, { name: 'Edited component' })
  const collection = session.graph.createCollection('Local')
  const variable = session.graph.createVariable('Width', 'FLOAT', collection.id, 200)
  session.graph.updateNode(first.id, { width: 123, boundVariables: { width: variable.id } })
  const firstPage = session.graph.getPages()[0]
  firstPage.childIds.reverse()
  const editedOrder = [...firstPage.childIds]
  session.loadPage(session.pages[1].id)
  expect(firstPage.childIds).toEqual(editedOrder)
  session.loadPage(session.pages[0].id)
  expect(session.graph.getNode(first.id)).toBe(first)
  expect(first.text).toBe('Edited')
  expect(first.width).toBe(123)
  expect(session.graph.getNode(existingComponent.id)).toBe(existingComponent)
  expect(existingComponent.name).toBe('Edited component')
  expect([...session.graph.getAllNodes()].filter((node) => node.type === 'COMPONENT')).toHaveLength(
    1
  )
  expect([...session.graph.getAllNodes()].filter((n) => n.type === 'TEXT')).toHaveLength(5)
})
