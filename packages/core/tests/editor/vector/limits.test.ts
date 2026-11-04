import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { vectorHandleId } from '@open-pencil/core/vector'
import { SceneGraph, type VectorNetwork } from '@open-pencil/scene-graph'

import { expectDefined } from '@open-pencil/test-support/assert'

/** An open path of three points, curved between the first two. */
const CURVE: VectorNetwork = {
  vertices: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 200, y: 0 }
  ],
  segments: [
    { start: 0, end: 1, tangentStart: { x: 30, y: -40 }, tangentEnd: { x: -30, y: -40 } },
    { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
  ],
  regions: []
}

/** An editor with the curve open for editing while only its handles may change. */
function openHandlesOnly() {
  const graph = new SceneGraph()
  const pageId = expectDefined(graph.getPages()[0]).id
  const vector = graph.createNode('VECTOR', pageId, {
    width: 200,
    height: 40,
    vectorNetwork: structuredClone(CURVE)
  })
  const editor = createEditor({ graph })
  editor.setHostRestrictions({ pathEdits: 'handles' })
  editor.enterNodeEditMode(vector.id)
  const session = () => expectDefined(editor.state.nodeEditState, 'path open for editing')
  /** The path as it is being edited: its points and how they connect. */
  const shape = () => ({
    vertices: session().vertices.map(({ x, y }) => ({ x, y })),
    segments: session().segments.map(({ start, end }) => ({ start, end }))
  })
  return { editor, vector, session, shape }
}

describe('a path whose points the host keeps', () => {
  test('gains, loses, joins, breaks, and aligns no points', () => {
    const { editor, shape } = openHandlesOnly()
    const before = shape()

    expect(editor.nodeEditAddVertex(150, 0)).toBe(false)
    editor.nodeEditRemoveVertex(1)
    editor.nodeEditConnectEndpoints(0, 2)
    editor.nodeEditSelectVertex(0, false)
    editor.nodeEditSelectVertex(2, true)
    editor.nodeEditAlignVertices('horizontal', 'min')
    editor.nodeEditBreakAtVertex()
    editor.nodeEditDeleteSelected()

    expect(shape()).toEqual(before)
  })

  test('still moves a handle', () => {
    const { editor, session } = openHandlesOnly()
    editor.nodeEditSetHandle(0, 'tangentStart', { x: 10, y: -60 })
    expect(session().segments[0]?.tangentStart).toEqual({ x: 10, y: -60 })
  })

  test('Delete retracts the selected handles and keeps every point and its selection', () => {
    const { editor, session, shape } = openHandlesOnly()
    const before = shape()
    editor.nodeEditSelectVertex(0, false)
    session().selectedHandles = new Set([vectorHandleId(0, 'tangentStart')])

    editor.nodeEditDeleteSelected()

    expect(shape()).toEqual(before)
    expect(session().segments[0]?.tangentStart).toEqual({ x: 0, y: 0 })
    expect(session().segments[0]?.tangentEnd).toEqual({ x: -30, y: -40 })
    expect([...session().selectedVertexIndices]).toEqual([0])
  })

  test('is not continued with the pen', () => {
    const { editor, vector } = openHandlesOnly()
    editor.penResumeFromEndpoint(vector.id, 2)
    editor.penStartPiece(vector.id, { x: 300, y: 100 })
    editor.penResumeOnPath(vector.id)
    expect(editor.state.penState).toBeNull()
    expect(editor.state.nodeEditState?.nodeId).toBe(vector.id)
  })

  test('takes points and pen continuation back once the host offers whole paths again', () => {
    const { editor, shape } = openHandlesOnly()
    editor.setHostRestrictions({ pathEdits: 'all' })
    editor.nodeEditRemoveVertex(1)
    expect(shape().vertices).toHaveLength(2)
  })

  test('a pen path continuing the layer stops growing when the host keeps points, and keeps what it drew', () => {
    const { editor, vector } = openHandlesOnly()
    editor.setHostRestrictions({ pathEdits: 'all' })
    editor.penResumeFromEndpoint(vector.id, 2)
    editor.penAddVertex(260, 0)
    expect(editor.state.penState?.vertices).toHaveLength(4)

    editor.setHostRestrictions({ pathEdits: 'handles' })

    expect(editor.state.penState).toBeNull()
    expect(editor.graph.getNode(vector.id)?.vectorNetwork?.vertices).toHaveLength(4)
  })

  test('regions stop being hatched under the pointer once only handles may change', () => {
    const { editor, session } = openHandlesOnly()
    editor.setHostRestrictions({ pathEdits: 'all' })
    session().hoveredRegion = 0
    editor.setHostRestrictions({ pathEdits: 'handles' })
    expect(session().hoveredRegion).toBeNull()
  })
})
