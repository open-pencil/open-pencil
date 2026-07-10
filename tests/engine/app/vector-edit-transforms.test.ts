import { describe, test, expect } from 'bun:test'

import type { Editor } from '@open-pencil/core/editor'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { SceneNode, VectorNetwork } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import { createVectorEditHistoryActions } from '@/app/editor/vector-edit/history'
import { createVectorEditLifecycle } from '@/app/editor/vector-edit/lifecycle'
import type { VectorEditState } from '@/app/editor/vector-edit/types'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'

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

  const undoLabels: string[] = []
  const editor = {
    get graph() {
      return graph
    },
    select: () => undefined,
    requestRender: () => undefined,
    updateNodeWithUndo(id: string, changes: Partial<SceneNode>, label = 'Update') {
      undoLabels.push(label)
      graph.updateNode(id, changes)
    }
  } as Editor
  const state: VectorEditState = { nodeEditState: null } as VectorEditState
  const lifecycle = createVectorEditLifecycle(editor, state)
  return { graph, vector, state, lifecycle, undoLabels }
}

/** World-space positions of a node's network vertices via its world matrix. */
function worldVertices(graph: SceneGraph, nodeId: string) {
  const node = getNodeOrThrow(graph, nodeId)
  const network = expectDefined(node.vectorNetwork, 'vectorNetwork')
  const world = getWorldMatrix(node, graph)
  return network.vertices.map((v) => Matrix.mapPoint(world, v))
}

describe('vector edit with rotated ancestors', () => {
  test('enter maps vertices through the full world matrix', () => {
    const { graph, vector, state, lifecycle } = setup(30, 20)
    lifecycle.enterNodeEditMode(vector.id)

    const expected = worldVertices(graph, vector.id)
    const es = expectDefined(state.nodeEditState, 'nodeEditState')
    for (let i = 0; i < expected.length; i++) {
      const point = expectDefined(expected[i])
      const vertex = expectDefined(es.vertices[i])
      expect(vertex.x).toBeCloseTo(point.x, 6)
      expect(vertex.y).toBeCloseTo(point.y, 6)
    }
  })

  test('enter + commit without edits is a no-op', () => {
    const { graph, vector, lifecycle, undoLabels } = setup(30, 20)
    const before = worldVertices(graph, vector.id)

    lifecycle.enterNodeEditMode(vector.id)
    lifecycle.exitNodeEditMode(true)

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
    // no geometry change → no document undo entry
    expect(undoLabels).toEqual([])
  })

  test('dragging a vertex commits without moving the rest of the shape', () => {
    const { graph, vector, state, lifecycle, undoLabels } = setup(30, 20)
    const before = worldVertices(graph, vector.id)

    lifecycle.enterNodeEditMode(vector.id)
    const es = expectDefined(state.nodeEditState, 'nodeEditState')
    const dragged = expectDefined(es.vertices[1])
    dragged.x += 25
    dragged.y -= 15
    const movedWorld = { x: dragged.x, y: dragged.y }
    lifecycle.exitNodeEditMode(true)

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
    expect(undoLabels).toEqual(['Edit vector'])
  })

  test('tangents rotate with the node on enter', () => {
    const { state, lifecycle, vector } = setup(0, 90)
    lifecycle.enterNodeEditMode(vector.id)
    const es = expectDefined(state.nodeEditState, 'nodeEditState')
    const t = expectDefined(es.segments[0]).tangentStart
    // local tangent (20, 10) rotated 90° → (-10, 20)
    expect(t.x).toBeCloseTo(-10, 6)
    expect(t.y).toBeCloseTo(20, 6)
  })
})

describe('vector edit session undo/redo', () => {
  function editSession() {
    const { graph, vector, state, lifecycle } = setup(0, 0)
    const editor = {
      get graph() {
        return graph
      },
      requestRender: () => undefined
    } as Editor
    const history = createVectorEditHistoryActions(editor, state)
    lifecycle.enterNodeEditMode(vector.id)
    return { state, history, es: expectDefined(state.nodeEditState, 'nodeEditState') }
  }

  test('undo restores geometry from before the mutation', () => {
    const { es, history } = editSession()
    const orig = { ...expectDefined(es.vertices[0]) }

    history.nodeEditPushHistory() // drag start
    es.vertices[0] = { ...orig, x: orig.x + 50, y: orig.y - 20 }
    history.nodeEditUndo()

    expect(expectDefined(es.vertices[0]).x).toBeCloseTo(orig.x, 6)
    expect(expectDefined(es.vertices[0]).y).toBeCloseTo(orig.y, 6)
  })

  test('redo reapplies the undone mutation', () => {
    const { es, history } = editSession()
    const orig = { ...expectDefined(es.vertices[0]) }

    history.nodeEditPushHistory()
    es.vertices[0] = { ...orig, x: orig.x + 50 }
    history.nodeEditUndo()
    history.nodeEditRedo()

    expect(expectDefined(es.vertices[0]).x).toBeCloseTo(orig.x + 50, 6)
  })

  test('no-op drag snapshots are skipped', () => {
    const { es, history } = editSession()
    const orig = { ...expectDefined(es.vertices[0]) }

    history.nodeEditPushHistory()
    es.vertices[0] = { ...orig, x: orig.x + 50 }
    history.nodeEditPushHistory() // click without move → identical snapshot
    history.nodeEditPushHistory()
    history.nodeEditUndo()

    expect(expectDefined(es.vertices[0]).x).toBeCloseTo(orig.x, 6)
  })

  test('undo with no history is a no-op', () => {
    const { es, history } = editSession()
    const orig = { ...expectDefined(es.vertices[0]) }
    history.nodeEditUndo()
    expect(expectDefined(es.vertices[0]).x).toBeCloseTo(orig.x, 6)
  })

  test('clicking without dragging after undo keeps redo', () => {
    const { state, history } = editSession()
    const es = () => expectDefined(state.nodeEditState, 'nodeEditState')
    const orig = { ...expectDefined(es().vertices[0]) }

    history.nodeEditPushHistory()
    es().vertices[0] = { ...orig, x: orig.x + 50 }
    history.nodeEditUndo()
    history.nodeEditPushHistory() // click a vertex without moving it
    history.nodeEditRedo()

    expect(expectDefined(es().vertices[0]).x).toBeCloseTo(orig.x + 50, 6)
  })

  test('a real change after undo clears redo', () => {
    const { state, history } = editSession()
    const es = () => expectDefined(state.nodeEditState, 'nodeEditState')
    const orig = { ...expectDefined(es().vertices[0]) }

    history.nodeEditPushHistory()
    es().vertices[0] = { ...orig, x: orig.x + 50 }
    history.nodeEditUndo()
    history.nodeEditPushHistory()
    es().vertices[0] = { ...orig, x: orig.x - 30 } // new timeline
    history.nodeEditRedo() // stale redo must not restore +50

    expect(expectDefined(es().vertices[0]).x).toBeCloseTo(orig.x - 30, 6)
  })
})
