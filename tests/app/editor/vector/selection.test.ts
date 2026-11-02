import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { SceneGraph, type VectorNetwork } from '@open-pencil/scene-graph'

import { createVectorEditActions } from '@/app/editor/vector/create'
import type { VectorEditState } from '@/app/editor/vector/types'

import { expectDefined } from '#tests/helpers/assert'

const zero = { x: 0, y: 0 }

/** An open path through four points: 0 → 1 → 2 → 3. */
const PATH: VectorNetwork = {
  vertices: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 }
  ],
  segments: [0, 1, 2].map((start) => ({
    start,
    end: start + 1,
    tangentStart: zero,
    tangentEnd: zero
  })),
  regions: []
}

function editPath() {
  const graph = new SceneGraph()
  const pageId = expectDefined(graph.getPages()[0]).id
  const vector = graph.createNode('VECTOR', pageId, {
    width: 100,
    height: 100,
    vectorNetwork: PATH
  })
  const editor = createEditor({ graph })
  // The actions share the editor's own state, as the app wires them.
  const state: VectorEditState = Object.assign(editor.state, { nodeEditState: null })
  const actions = createVectorEditActions(editor, state)
  actions.enterNodeEditMode(vector.id)
  return { editor, graph, vector, state, actions, es: expectDefined(state.nodeEditState) }
}

test('Delete removes a selected segment, splitting the path and keeping its points', () => {
  const { state, actions, es } = editPath()
  es.selectedSegmentIndices = new Set([1])
  actions.nodeEditDeleteSelected()
  const after = expectDefined(state.nodeEditState)
  expect(after.vertices).toHaveLength(4)
  expect(after.segments.map((s) => [s.start, s.end])).toEqual([
    [0, 1],
    [2, 3]
  ])
  expect(after.selectedSegmentIndices.size).toBe(0)
})

test('Delete removes the layer once nothing of the path is left', () => {
  const { graph, vector, state, actions, es } = editPath()
  es.selectedSegmentIndices = new Set([0, 1, 2])
  actions.nodeEditDeleteSelected()
  expect(state.nodeEditState).toBeNull()
  expect(graph.getNode(vector.id)).toBeUndefined()
})

test('undo inside the path forgets the selected segments', () => {
  const { state, actions, es } = editPath()
  es.selectedSegmentIndices = new Set([0])
  actions.nodeEditDeleteSelected()
  expectDefined(state.nodeEditState).selectedSegmentIndices = new Set([0])
  actions.nodeEditUndo()
  expect(expectDefined(state.nodeEditState).segments).toHaveLength(3)
  expect(expectDefined(state.nodeEditState).selectedSegmentIndices.size).toBe(0)
})

test('deleting every point keeps the edits made before it for undo', () => {
  const { editor, graph, vector, state, actions, es } = editPath()
  actions.nodeEditPushHistory()
  es.vertices[3] = { ...es.vertices[3], y: 140 }
  es.selectedSegmentIndices = new Set([0, 1, 2])
  actions.nodeEditDeleteSelected()
  expect(state.nodeEditState).toBeNull()
  expect(graph.getNode(vector.id)).toBeUndefined()

  editor.undo.undo()
  const restored = expectDefined(graph.getNode(vector.id)?.vectorNetwork)
  expect(restored.vertices.map(({ x, y }) => ({ x, y }))).toContainEqual({ x: 0, y: 140 })
})
