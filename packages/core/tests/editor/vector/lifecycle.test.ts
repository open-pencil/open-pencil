import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { handleVisibleVertices } from '@open-pencil/core/vector'
import { SceneGraph, type VectorNetwork } from '@open-pencil/scene-graph'

import { expectDefined } from '@open-pencil/test-support/assert'
const TRIANGLE: VectorNetwork = {
  vertices: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 50, y: 50 }
  ],
  segments: [0, 1, 2].map((start) => ({
    start,
    end: (start + 1) % 3,
    tangentStart: { x: 0, y: 0 },
    tangentEnd: { x: 0, y: 0 }
  })),
  regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
}

test('opens a vector in a component but not its copy in an instance, as Figma does', () => {
  const graph = new SceneGraph()
  const pageId = expectDefined(graph.getPages()[0]).id
  const component = graph.createNode('COMPONENT', pageId, { width: 200, height: 120 })
  const vector = graph.createNode('VECTOR', component.id, {
    width: 100,
    height: 50,
    vectorNetwork: TRIANGLE
  })
  const instance = expectDefined(graph.createInstance(component.id, pageId))
  const copy = expectDefined(graph.getChildren(instance.id)[0])
  const editor = createEditor({ graph })

  editor.enterNodeEditMode(copy.id)
  expect(editor.state.nodeEditState).toBeNull()
  editor.enterNodeEditMode(vector.id)
  expect(editor.state.nodeEditState?.nodeId).toBe(vector.id)
})

test('closes the path when its layer is deleted or the document is replaced', () => {
  const graph = new SceneGraph()
  const pageId = expectDefined(graph.getPages()[0]).id
  const open = (target: SceneGraph) =>
    target.createNode('VECTOR', expectDefined(target.getPages()[0]).id, {
      width: 100,
      height: 50,
      vectorNetwork: TRIANGLE
    })
  const vector = open(graph)
  const editor = createEditor({ graph })

  editor.enterNodeEditMode(vector.id)
  graph.deleteNode(graph.createNode('RECTANGLE', pageId).id)
  expect(editor.state.nodeEditState?.nodeId).toBe(vector.id)
  graph.deleteNode(vector.id)
  expect(editor.state.nodeEditState).toBeNull()

  const next = new SceneGraph()
  editor.enterNodeEditMode(open(graph).id)
  editor.replaceGraph(next)
  expect(editor.state.nodeEditState).toBeNull()
})

test('commits the open path before opening another, and keeps it open when opened again', () => {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const first = editor.graph.createNode('VECTOR', pageId, { width: 100, height: 50, vectorNetwork: TRIANGLE })
  const second = editor.graph.createNode('VECTOR', pageId, { width: 100, height: 50, vectorNetwork: TRIANGLE })

  editor.enterNodeEditMode(first.id)
  const session = expectDefined(editor.state.nodeEditState)
  expectDefined(session.vertices[0]).x -= 20
  editor.enterNodeEditMode(first.id)
  expect(editor.state.nodeEditState).toBe(session)

  editor.enterNodeEditMode(second.id)
  expect(editor.state.nodeEditState?.nodeId).toBe(second.id)
  expect(editor.graph.getNode(first.id)?.width).toBe(120)
})

test('does not open a library layer, which changes in its library', () => {
  const editor = createEditor()
  const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
    librarySource: {
      identity: { libraryId: 'design-system', assetKey: 'icon', revisionId: 'r1' },
      sourceNodeId: 'source',
      readOnly: true
    }
  })
  const vector = editor.graph.createNode('VECTOR', component.id, {
    width: 100,
    height: 50,
    vectorNetwork: TRIANGLE
  })

  editor.enterNodeEditMode(vector.id)
  expect(editor.state.nodeEditState).toBeNull()
})

// Figma desktop 126: picking another layer in the layers panel leaves vector edit mode, keeps the
// edit, and selects that layer.
test('selecting another layer commits the open path and leaves edit mode', () => {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const path = editor.graph.createNode('VECTOR', pageId, { width: 100, height: 50, vectorNetwork: TRIANGLE })
  const other = editor.graph.createNode('RECTANGLE', pageId, { x: 300, width: 50, height: 50 })

  editor.enterNodeEditMode(path.id)
  expectDefined(editor.state.nodeEditState?.vertices[0]).x -= 20
  editor.select([path.id])
  expect(editor.state.nodeEditState?.nodeId).toBe(path.id)

  editor.select([other.id])
  expect(editor.state.nodeEditState).toBeNull()
  expect(editor.graph.getNode(path.id)?.width).toBe(120)
  expect([...editor.state.selectedIds]).toEqual([other.id])
})

// Figma desktop 126: H in vector edit mode commits the path and leaves edit mode for the hand;
// holding Space pans with the path still open, and Move and the pen stay in edit mode.
test('picking a tool that does not edit paths leaves edit mode; holding one does not', () => {
  const editor = createEditor()
  const path = editor.graph.createNode('VECTOR', editor.state.currentPageId, {
    width: 100,
    height: 50,
    vectorNetwork: TRIANGLE
  })
  editor.enterNodeEditMode(path.id)
  expectDefined(editor.state.nodeEditState?.vertices[0]).x -= 20

  editor.setTool('HAND', { held: true })
  editor.setTool('SELECT', { held: true })
  editor.setTool('PEN')
  editor.setTool('SELECT')
  expect(editor.state.nodeEditState?.nodeId).toBe(path.id)

  editor.setTool('HAND')
  expect(editor.state.nodeEditState).toBeNull()
  expect(editor.state.activeTool).toBe('HAND')
  expect(editor.graph.getNode(path.id)?.width).toBe(120)
  expect([...editor.state.selectedIds]).toEqual([path.id])
})

test('a document opened over the path drops it, without writing into the new document', () => {
  const graph = new SceneGraph()
  const editor = createEditor({ graph })
  const path = graph.createNode('VECTOR', editor.state.currentPageId, { width: 100, height: 50, vectorNetwork: TRIANGLE })
  editor.enterNodeEditMode(path.id)
  expectDefined(editor.state.nodeEditState?.vertices[0]).x -= 20

  const next = new SceneGraph()
  const pageId = expectDefined(next.getPages()[0]).id
  const twin = next.createNodeWithId(path.id, 'VECTOR', pageId, { width: 100, height: 50, vectorNetwork: TRIANGLE })
  editor.replaceGraph(next)

  expect(editor.state.nodeEditState).toBeNull()
  expect(next.getNode(twin.id)?.vectorNetwork).toEqual(TRIANGLE)
  expect(graph.getNode(path.id)?.width).toBe(100)
})

test('a tool the document does not offer leaves the path open', () => {
  const editor = createEditor()
  const path = editor.graph.createNode('VECTOR', editor.state.currentPageId, { width: 100, height: 50, vectorNetwork: TRIANGLE })
  editor.setDocumentKind('board')
  editor.enterNodeEditMode(path.id)

  editor.setTool('RECTANGLE')
  expect(editor.state.activeTool).not.toBe('RECTANGLE')
  expect(editor.state.nodeEditState?.nodeId).toBe(path.id)
})

describe('a path the host keeps open', () => {
  function keptOpen() {
    const graph = new SceneGraph()
    const pageId = expectDefined(graph.getPages()[0]).id
    const vector = graph.createNode('VECTOR', pageId, {
      width: 100,
      height: 50,
      vectorNetwork: structuredClone(TRIANGLE)
    })
    const other = graph.createNode('RECTANGLE', pageId, { x: 300, width: 40, height: 40 })
    const editor = createEditor({ graph })
    editor.enterNodeEditMode(vector.id, { keepOpen: true })
    return { editor, vector, other }
  }

  test('stays open through what leaves an ordinary path', () => {
    const { editor, vector, other } = keptOpen()
    editor.exitNodeEditMode(true)
    editor.setTool('HAND')
    editor.select([other.id])
    editor.enterNodeEditMode(other.id)
    expect(editor.state.nodeEditState?.nodeId).toBe(vector.id)
    expect([...editor.state.selectedIds]).toEqual([vector.id])
  })

  test('keeps its last points, so its layer stays', () => {
    const { editor, vector } = keptOpen()
    for (const index of [0, 1, 2]) editor.nodeEditSelectVertex(index, index > 0)
    editor.nodeEditDeleteSelected()
    expect(editor.graph.getNode(vector.id)).toBeDefined()
    expect(editor.state.nodeEditState?.vertices).toHaveLength(3)
    expect(editor.state.nodeEditState?.history).toEqual([])
  })

  test('is not left for the pen', () => {
    const { editor, vector } = keptOpen()
    editor.penResumeFromEndpoint(vector.id, 0)
    expect(editor.state.penState).toBeNull()
  })

  test('ends when its page is switched away from', async () => {
    const { editor, vector } = keptOpen()
    const second = editor.graph.addPage('Second')
    await editor.switchPage(second.id)
    expect(editor.state.nodeEditState).toBeNull()
    expect(editor.state.selectedIds.has(vector.id)).toBe(false)
  })

  test('ends when the host releases it, or the document goes read-only', () => {
    const released = keptOpen()
    released.editor.exitNodeEditMode(true, { release: true })
    expect(released.editor.state.nodeEditState).toBeNull()

    const readOnly = keptOpen()
    readOnly.editor.setReadOnly(true)
    expect(readOnly.editor.state.nodeEditState).toBeNull()
  })
})

test('a host can show the handles of every point, not only near the selection', () => {
  const graph = new SceneGraph()
  const pageId = expectDefined(graph.getPages()[0]).id
  const vector = graph.createNode('VECTOR', pageId, {
    width: 100,
    height: 50,
    vectorNetwork: structuredClone(TRIANGLE)
  })
  const editor = createEditor({ graph })

  editor.enterNodeEditMode(vector.id)
  expect(handleVisibleVertices(expectDefined(editor.state.nodeEditState))).toEqual(new Set())
  editor.exitNodeEditMode(true)
  editor.enterNodeEditMode(vector.id, { handles: 'all' })
  expect(handleVisibleVertices(expectDefined(editor.state.nodeEditState))).toEqual(
    new Set([0, 1, 2])
  )
})
