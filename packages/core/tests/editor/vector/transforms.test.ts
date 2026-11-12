import { describe, test, expect } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { computeHandleVisibleVertices, regenerateFillGeometry } from '@open-pencil/core/vector'
import { SceneGraph, type VectorNetwork } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import { expectDefined, getNodeOrThrow } from '@open-pencil/test-support/assert'
const NETWORK: VectorNetwork = {
  vertices: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
    { x: 0, y: 50 }
  ],
  segments: [
    { start: 0, end: 1, tangentStart: { x: 20, y: 10 }, tangentEnd: { x: -20, y: 0 } },
    { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
    { start: 2, end: 3, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
    { start: 3, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
  ],
  regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
}

function setup(frameRotation: number, vectorRotation: number) {
  const graph = new SceneGraph()
  const pageId = expectDefined(graph.getPages()[0]).id
  const frame = graph.createNode('FRAME', pageId, {
    x: 300,
    y: 200,
    width: 400,
    height: 300,
    rotation: frameRotation
  })
  const vector = graph.createNode('VECTOR', frame.id, {
    x: 40,
    y: 60,
    width: 100,
    height: 50,
    rotation: vectorRotation,
    vectorNetwork: {
      vertices: NETWORK.vertices.map((v) => ({ ...v })),
      segments: NETWORK.segments.map((s) => ({
        ...s,
        tangentStart: { ...s.tangentStart },
        tangentEnd: { ...s.tangentEnd }
      })),
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
    }
  })

  const editor = createEditor({ graph })
  /** The document's undo steps, oldest first. */
  const undoLabels = () => {
    const labels: string[] = []
    for (let entry = editor.undo.peekUndo(); entry; entry = editor.undo.peekUndo(labels.length))
      labels.unshift(entry.label)
    return labels
  }
  return { graph, vector, editor, undoLabels }
}

/** World-space positions of a node's network vertices via its world matrix. */
function worldVertices(graph: SceneGraph, nodeId: string) {
  const node = getNodeOrThrow(graph, nodeId)
  const network = expectDefined(node.vectorNetwork, 'vectorNetwork')
  const world = getWorldMatrix(node, graph)
  return network.vertices.map((v) => Matrix.mapPoint(world, v))
}

describe('vector edit graph ownership', () => {
  test('ignores stale selected handle indices', () => {
    const segments = [
      { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
    ]
    expect(computeHandleVisibleVertices(new Set([0]), new Set([99, -1, 2]), segments)).toEqual(
      new Set([0, 1])
    )
  })
  test('enters edit mode after the editor graph is replaced', () => {
    const initial = new SceneGraph()
    const replacement = new SceneGraph()
    const vector = replacement.createNode('VECTOR', expectDefined(replacement.getPages()[0]).id, {
      width: 100,
      height: 50,
      vectorNetwork: NETWORK
    })
    const editor = createEditor({ graph: initial })

    editor.replaceGraph(replacement)
    editor.enterNodeEditMode(vector.id)

    expect(editor.state.nodeEditState?.nodeId).toBe(vector.id)
  })

  test('commits network and fill geometry as one document undo step', () => {
    const editor = createEditor()
    const page = expectDefined(editor.graph.getPages()[0])
    const fillGeometry = regenerateFillGeometry(NETWORK, [
      { windingRule: 'NONZERO', commandsBlob: new Uint8Array() }
    ])
    const vector = editor.graph.createNode('VECTOR', page.id, {
      width: 100,
      height: 50,
      vectorNetwork: NETWORK,
      fillGeometry
    })
    const originalBlob = expectDefined(vector.fillGeometry[0]).commandsBlob.slice()

    editor.enterNodeEditMode(vector.id)
    const editState = expectDefined(editor.state.nodeEditState)
    expectDefined(editState.vertices[1]).x += 20
    editor.exitNodeEditMode(true)

    const edited = getNodeOrThrow(editor.graph, vector.id)
    const editedBlob = expectDefined(edited.fillGeometry[0]).commandsBlob.slice()
    expect(editedBlob).not.toEqual(originalBlob)
    expect(editor.undo.canUndo).toBe(true)

    // Undo opens the path again, then takes back its change; redo leaves it changed.
    editor.undo.undo()
    editor.undo.undo()
    expect(
      expectDefined(getNodeOrThrow(editor.graph, vector.id).fillGeometry[0]).commandsBlob
    ).toEqual(originalBlob)

    editor.undo.redo()
    editor.undo.redo()
    expect(
      expectDefined(getNodeOrThrow(editor.graph, vector.id).fillGeometry[0]).commandsBlob
    ).toEqual(editedBlob)
  })
})

describe('vector edit with rotated ancestors', () => {
  test('enter maps vertices through the full world matrix', () => {
    const { graph, vector, editor } = setup(30, 20)
    editor.enterNodeEditMode(vector.id)

    const expected = worldVertices(graph, vector.id)
    const es = expectDefined(editor.state.nodeEditState, 'nodeEditState')
    for (let i = 0; i < expected.length; i++) {
      const point = expectDefined(expected[i])
      const vertex = expectDefined(es.vertices[i])
      expect(vertex.x).toBeCloseTo(point.x, 6)
      expect(vertex.y).toBeCloseTo(point.y, 6)
    }
  })

  test('enter + commit without edits leaves the layer as it was', () => {
    const { graph, vector, editor, undoLabels } = setup(30, 20)
    const before = worldVertices(graph, vector.id)

    editor.enterNodeEditMode(vector.id)
    editor.exitNodeEditMode(true)

    const node = getNodeOrThrow(graph, vector.id)
    expect(node.x).toBe(40)
    expect(node.y).toBe(60)
    expect(node.width).toBe(100)
    expect(node.height).toBe(50)
    const after = worldVertices(graph, vector.id)
    for (let i = 0; i < before.length; i++) {
      const b = expectDefined(before[i])
      const a = expectDefined(after[i])
      expect(a.x).toBeCloseTo(b.x, 6)
      expect(a.y).toBeCloseTo(b.y, 6)
    }
    // Entering and leaving are steps, as in Figma; the layer has none.
    expect(undoLabels()).toEqual(['Enter path', 'Leave path'])
  })

  test('dragging a vertex commits without moving the rest of the shape', () => {
    const { graph, vector, editor, undoLabels } = setup(30, 20)
    const before = worldVertices(graph, vector.id)

    editor.enterNodeEditMode(vector.id)
    const es = expectDefined(editor.state.nodeEditState, 'nodeEditState')
    const dragged = expectDefined(es.vertices[1])
    dragged.x += 25
    dragged.y -= 15
    const movedWorld = { x: dragged.x, y: dragged.y }
    editor.exitNodeEditMode(true)

    const after = worldVertices(graph, vector.id)
    expect(expectDefined(after[1]).x).toBeCloseTo(movedWorld.x, 5)
    expect(expectDefined(after[1]).y).toBeCloseTo(movedWorld.y, 5)
    for (const i of [0, 2, 3]) {
      const b = expectDefined(before[i])
      const a = expectDefined(after[i])
      expect(a.x).toBeCloseTo(b.x, 5)
      expect(a.y).toBeCloseTo(b.y, 5)
    }
    // rotation is preserved, geometry is re-normalized to the new bounds
    const node = getNodeOrThrow(graph, vector.id)
    const network = expectDefined(node.vectorNetwork, 'vectorNetwork')
    expect(node.rotation).toBe(20)
    expect(Math.min(...network.vertices.map((v) => v.x))).toBeCloseTo(0, 5)
    expect(Math.min(...network.vertices.map((v) => v.y))).toBeCloseTo(0, 5)
    // committing goes through the undo-aware update so Cmd+Z works
    expect(undoLabels()).toEqual(['Enter path', 'Edit vector', 'Leave path'])
  })

  test('committing one drag rebases the active edit session for the next drag', () => {
    const { graph, vector, editor, undoLabels } = setup(0, 0)
    editor.enterNodeEditMode(vector.id)
    const first = expectDefined(editor.state.nodeEditState)
    first.vertices[0] = { ...expectDefined(first.vertices[0]), x: 25, y: 10 }

    editor.commitNodeEditChanges()

    const committed = getNodeOrThrow(graph, vector.id)
    expect(editor.state.nodeEditState).toBe(first)
    expect(undoLabels()).toEqual(['Enter path', 'Edit vector'])
    expect(expectDefined(first.origAbsNetwork.vertices[0]).x).toBeCloseTo(25, 5)
    expect(expectDefined(first.origAbsNetwork.vertices[0]).y).toBeCloseTo(10, 5)
    expect(committed).toBeDefined()

    first.vertices[0] = { ...expectDefined(first.vertices[0]), x: 40, y: 20 }
    editor.commitNodeEditChanges()
    expect(undoLabels()).toEqual(['Enter path', 'Edit vector', 'Edit vector'])
    expect(expectDefined(first.origAbsNetwork.vertices[0]).x).toBeCloseTo(40, 5)
    expect(expectDefined(first.origAbsNetwork.vertices[0]).y).toBeCloseTo(20, 5)
  })
  test('tangents rotate with the node on enter', () => {
    const { editor, vector } = setup(0, 90)
    editor.enterNodeEditMode(vector.id)
    const es = expectDefined(editor.state.nodeEditState, 'nodeEditState')
    const t = expectDefined(es.segments[0]).tangentStart
    // local tangent (20, 10) rotated 90° → (-10, 20)
    expect(t.x).toBeCloseTo(-10, 6)
    expect(t.y).toBeCloseTo(20, 6)
  })
})

describe('vector edit undo and redo', () => {
  function editSession() {
    const { vector, editor, undoLabels } = setup(0, 0)
    editor.enterNodeEditMode(vector.id)
    const es = () => expectDefined(editor.state.nodeEditState, 'nodeEditState')
    return { editor, vector, es, undoLabels, orig: { ...expectDefined(es().vertices[0]) } }
  }

  test('undo puts the path back as it was before the change', () => {
    const { es, editor, orig } = editSession()

    editor.nodeEditPushHistory() // drag start
    es().vertices[0] = { ...orig, x: orig.x + 50, y: orig.y - 20 }
    editor.undoAction()

    expect(expectDefined(es().vertices[0]).x).toBeCloseTo(orig.x, 6)
    expect(expectDefined(es().vertices[0]).y).toBeCloseTo(orig.y, 6)
  })

  test('redo makes the change again', () => {
    const { es, editor, orig } = editSession()

    editor.nodeEditPushHistory()
    es().vertices[0] = { ...orig, x: orig.x + 50 }
    editor.undoAction()
    editor.redoAction()

    expect(expectDefined(es().vertices[0]).x).toBeCloseTo(orig.x + 50, 6)
  })

  test('presses that change nothing are no steps', () => {
    const { es, editor, orig, undoLabels } = editSession()

    editor.nodeEditPushHistory()
    es().vertices[0] = { ...orig, x: orig.x + 50 }
    editor.nodeEditPushHistory() // click without move
    editor.nodeEditPushHistory()
    expect(undoLabels()).toEqual(['Enter path', 'Edit vector'])
    editor.undoAction()

    expect(expectDefined(es().vertices[0]).x).toBeCloseTo(orig.x, 6)
  })

  test('undo past the first change leaves the path, and redo opens it again', () => {
    const { editor, vector } = editSession()
    editor.undoAction()
    expect(editor.state.nodeEditState).toBeNull()
    editor.redoAction()
    expect(editor.state.nodeEditState?.nodeId).toBe(vector.id)
  })

  test('clicking without dragging after undo keeps redo', () => {
    const { es, editor, orig } = editSession()

    editor.nodeEditPushHistory()
    es().vertices[0] = { ...orig, x: orig.x + 50 }
    editor.undoAction()
    editor.nodeEditPushHistory() // click a vertex without moving it
    editor.redoAction()

    expect(expectDefined(es().vertices[0]).x).toBeCloseTo(orig.x + 50, 6)
  })

  test('a real change after undo clears redo', () => {
    const { es, editor, orig } = editSession()

    editor.nodeEditPushHistory()
    es().vertices[0] = { ...orig, x: orig.x + 50 }
    editor.undoAction()
    editor.nodeEditPushHistory()
    es().vertices[0] = { ...orig, x: orig.x - 30 } // new timeline
    editor.redoAction() // stale redo must not restore +50

    expect(expectDefined(es().vertices[0]).x).toBeCloseTo(orig.x - 30, 6)
  })

  test('undo after leaving opens the path again and takes back its changes one by one', () => {
    const { es, editor, orig, vector } = editSession()
    for (const dx of [10, 20]) {
      editor.nodeEditPushHistory()
      es().vertices[0] = { ...orig, x: orig.x + dx }
      editor.commitNodeEditChanges()
    }
    editor.exitNodeEditMode(true)
    const edited = structuredClone(editor.graph.getNode(vector.id)?.vectorNetwork)
    const x = () => expectDefined(editor.state.nodeEditState?.vertices[0]).x

    editor.undoAction()
    expect(editor.state.nodeEditState?.nodeId).toBe(vector.id)
    expect(x()).toBeCloseTo(orig.x + 20, 6)
    editor.undoAction()
    expect(x()).toBeCloseTo(orig.x + 10, 6)
    editor.undoAction()
    expect(x()).toBeCloseTo(orig.x, 6)
    editor.undoAction()
    expect(editor.state.nodeEditState).toBeNull()

    for (let i = 0; i < 4; i++) editor.redoAction()
    expect(editor.state.nodeEditState).toBeNull()
    expect(editor.graph.getNode(vector.id)?.vectorNetwork).toEqual(expectDefined(edited))
  })
})
