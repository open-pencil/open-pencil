import { afterEach, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import { SceneGraph, type VectorNetwork } from '@open-pencil/scene-graph'

import { expectDefined } from '#core-tests/helpers/assert'

const STRAIGHT = { tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }

/** A T: a bar 0-1-2 and a stem 1-3 hanging from its middle. */
const T: VectorNetwork = {
  vertices: [
    { x: 0, y: 0 },
    { x: 50, y: 0 },
    { x: 100, y: 0 },
    { x: 50, y: 80 }
  ],
  segments: [
    { start: 0, end: 1, ...STRAIGHT },
    { start: 1, end: 2, ...STRAIGHT },
    { start: 1, end: 3, ...STRAIGHT }
  ],
  regions: []
}

let editor: Editor

afterEach(() => editor.dispose())

function setup() {
  editor = createEditor()
  const vector = editor.graph.createNode('VECTOR', editor.state.currentPageId, {
    width: 100,
    height: 80,
    vectorNetwork: structuredClone(T)
  })
  return { pen: editor, id: vector.id }
}

const points = (network: VectorNetwork | null | undefined) =>
  expectDefined(network).vertices.map(({ x, y }) => ({ x, y }))

const lines = (network: VectorNetwork | null | undefined) =>
  expectDefined(network).segments.map(({ start, end }) => [start, end])

test('continues a branched path from the endpoint pressed', () => {
  const { pen, id } = setup()
  pen.penResumeFromEndpoint(id, 3)
  const last = expectDefined(editor.state.penState?.vertices.at(-1))
  expect({ x: last.x, y: last.y }).toEqual({ x: 50, y: 80 })
})

test('leaves a branched path whole when the pen adds nothing', () => {
  const { pen, id } = setup()
  pen.penResumeFromEndpoint(id, 3)
  editor.penCommit(false)

  expect(editor.graph.getNode(id)?.vectorNetwork).toEqual(T)
  expect(editor.undo.canUndo).toBe(false)
})

test('keeps the branches the pen did not walk when it adds a point', () => {
  const { pen, id } = setup()
  pen.penResumeFromEndpoint(id, 3)
  editor.penAddVertex(50, 120)
  editor.penCommit(false)

  const network = editor.graph.getNode(id)?.vectorNetwork
  expect(points(network)).toEqual([...points(T), { x: 50, y: 120 }])
  expect(lines(network)).toEqual([...lines(T), [3, 4]])

  editor.undo.undo()
  expect(editor.graph.getNode(id)?.vectorNetwork).toEqual(T)
})

// Figma desktop 126: a pen click off the path in vector edit mode starts a new piece of the same
// layer, and the points drawn from it join the network unconnected to the rest.
test('a new piece adds its points and segments beside the path', () => {
  const { pen, id } = setup()
  pen.penStartPiece(id, { x: 0, y: 120 })
  editor.penAddVertex(100, 120)
  editor.penCommit(false)

  const network = editor.graph.getNode(id)?.vectorNetwork
  expect(points(network)).toEqual([...points(T), { x: 0, y: 120 }, { x: 100, y: 120 }])
  expect(lines(network)).toEqual([...lines(T), [4, 5]])
  expect(editor.graph.getChildren(editor.state.currentPageId)).toHaveLength(1)

  editor.undo.undo()
  expect(editor.graph.getNode(id)?.vectorNetwork).toEqual(T)
})

test('a new piece with one point leaves the path as it was', () => {
  const { pen, id } = setup()
  pen.penStartPiece(id, { x: 0, y: 120 })
  editor.penCommit(false)

  expect(editor.graph.getNode(id)?.vectorNetwork).toEqual(T)
  expect(editor.undo.canUndo).toBe(false)
})

/** A read-only library component holding a copy of the T, as a library's own layers are. */
function libraryVector() {
  const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
    librarySource: {
      identity: { libraryId: 'design-system', assetKey: 'icon', revisionId: 'r1' },
      sourceNodeId: 'source',
      readOnly: true
    }
  })
  return editor.graph.createNode('VECTOR', component.id, {
    width: 100,
    height: 80,
    vectorNetwork: structuredClone(T)
  })
}

test('commits the path open for editing before continuing it', () => {
  const { pen, id } = setup()
  editor.enterNodeEditMode(id)
  const stem = expectDefined(editor.state.nodeEditState?.vertices[3])
  stem.y = 100

  pen.penResumeFromEndpoint(id, 3)

  expect(editor.state.nodeEditState).toBeNull()
  expect(points(editor.graph.getNode(id)?.vectorNetwork).at(3)).toEqual({ x: 50, y: 100 })
  const last = expectDefined(editor.state.penState?.vertices.at(-1))
  expect({ x: last.x, y: last.y }).toEqual({ x: 50, y: 100 })
})

test('commits a pen path in progress before continuing another', () => {
  const { pen, id } = setup()
  editor.setTool('PEN')
  editor.penAddVertex(200, 0)
  editor.penAddVertex(300, 0)

  pen.penResumeOnPath(id)

  expect(editor.graph.getChildren(editor.state.currentPageId)).toHaveLength(2)
  expect(editor.state.penState?.resumingNodeId).toBe(id)
})

test('does not continue from a point the path does not have', () => {
  const { pen, id } = setup()
  for (const index of [-1, 4, 1.5]) pen.penResumeFromEndpoint(id, index)
  expect(editor.state.penState).toBeNull()
})

test('does not continue a library layer or a board path', () => {
  const { pen, id } = setup()
  pen.penResumeOnPath(libraryVector().id)
  expect(editor.state.penState).toBeNull()

  editor.setDocumentKind('board')
  pen.penResumeOnPath(id)
  expect(editor.state.penState).toBeNull()
})

test('a point the open path does not have commits nothing and keeps it open', () => {
  const { pen, id } = setup()
  editor.enterNodeEditMode(id)
  expectDefined(editor.state.nodeEditState?.vertices[3]).y = 100

  pen.penResumeFromEndpoint(id, 9)

  expect(editor.state.nodeEditState?.nodeId).toBe(id)
  expect(editor.state.penState).toBeNull()
  expect(editor.graph.getNode(id)?.vectorNetwork).toEqual(T)
})

test('opening the path while the pen continues it keeps what the pen drew', () => {
  const { pen, id } = setup()
  pen.penResumeFromEndpoint(id, 3)
  editor.penAddVertex(50, 120)

  editor.enterNodeEditMode(id)
  expect(editor.state.penState).toBeNull()
  editor.exitNodeEditMode(false)

  expect(points(editor.graph.getNode(id)?.vectorNetwork)).toEqual([...points(T), { x: 50, y: 120 }])
})

test('a pen path stays with its document when another one is opened', () => {
  setup()
  const previous = editor.graph
  const pageId = editor.state.currentPageId
  const before = previous.getChildren(pageId).length
  editor.setTool('PEN')
  editor.penAddVertex(200, 0)
  editor.penAddVertex(300, 0)

  const next = new SceneGraph()
  editor.replaceGraph(next)
  editor.setTool('RECTANGLE')

  expect(editor.state.penState).toBeNull()
  expect(next.getChildren(editor.state.currentPageId)).toHaveLength(0)
  expect(previous.getChildren(pageId)).toHaveLength(before)
})
