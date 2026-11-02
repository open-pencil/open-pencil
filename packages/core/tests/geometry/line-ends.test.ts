import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import {
  aimLine,
  draggedLineEnds,
  isLineLike,
  lineWorldEnds,
  type LineEnd
} from '@open-pencil/core/geometry'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { createConnector, freeEndpoint } from '@open-pencil/scene-graph/connectors'
import type { Vector } from '@open-pencil/scene-graph/primitives'

/** An arrow as Figma's Arrow tool draws one: a flat vector along its width, aimed by rotation. */
function arrow(graph: SceneGraph, start: Vector, end: Vector): SceneNode {
  const page = graph.getPages()[0].id
  const line = graph.createNode('VECTOR', page, {
    width: 1,
    height: 0,
    vectorNetwork: {
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0, strokeCap: 'ARROW_LINES' }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    }
  })
  return aimAt(graph, line, start, end)
}

function aimAt(graph: SceneGraph, line: SceneNode, start: Vector, end: Vector): SceneNode {
  const changes = aimLine(graph, line, start, end)
  if (!changes) throw new Error('The ends meet')
  graph.updateNode(line.id, changes)
  const aimed = graph.getNode(line.id)
  if (!aimed) throw new Error('The line is gone')
  return aimed
}

/** Drags one end of `line` by `delta` and returns its ends after, rounded as Figma reports them. */
function drag(
  graph: SceneGraph,
  line: SceneNode,
  end: LineEnd,
  delta: Vector,
  modifiers: { shift?: boolean; alt?: boolean } = {}
) {
  const [start, finish] = draggedLineEnds(lineWorldEnds(graph, line), end, delta, modifiers)
  const aimed = aimAt(graph, line, start, finish)
  const round = ({ x, y }: Vector) => [Math.round(x * 100) / 100 + 0, Math.round(y * 100) / 100 + 0]
  return {
    ends: lineWorldEnds(graph, aimed).map(round),
    length: Math.round(Math.max(aimed.width, aimed.height) * 100) / 100,
    rotation: Math.round(aimed.rotation * 100) / 100,
    aimed
  }
}

// Measured in Figma by dragging an arrow's end handle on 2026-10-16. Figma turns y up, so its
// rotations here have the opposite sign.
describe('dragging a line by an end', () => {
  test('the end follows the pointer and the other end stays', () => {
    const graph = new SceneGraph()
    const line = arrow(graph, { x: 0, y: 0 }, { x: 225.17, y: -130 })
    const result = drag(graph, line, 'end', { x: 16.83, y: 160 })
    expect(result.ends).toEqual([
      [0, 0],
      [242, 30]
    ])
    expect(result.length).toBe(243.85)
    expect(result.rotation).toBe(7.07)
    expect(result.aimed.height).toBe(0)
    expect(result.aimed.vectorNetwork?.vertices.map((vertex) => vertex.x)).toEqual([
      0,
      result.aimed.width
    ])
  })

  test('Shift holds it to 45° steps, as far as the pointer reaches along them', () => {
    const cases: Array<[Vector, number[], number]> = [
      [{ x: 122, y: -30 }, [382, 0], 382],
      [{ x: 82, y: -150 }, [246, -246], 347.9],
      [{ x: -18, y: 150 }, [196, 196], 277.19]
    ]
    for (const [delta, end, length] of cases) {
      const graph = new SceneGraph()
      const line = arrow(graph, { x: 0, y: 0 }, { x: 260, y: 0 })
      const result = drag(graph, line, 'end', delta, { shift: true })
      expect(result.ends).toEqual([[0, 0], end])
      expect(result.length).toBe(length)
    }
  })

  test('Alt keeps the midpoint and moves the other end opposite', () => {
    const graph = new SceneGraph()
    const line = arrow(graph, { x: 0, y: 0 }, { x: 302, y: 0 })
    expect(drag(graph, line, 'end', { x: 40, y: -50 }, { alt: true }).ends).toEqual([
      [-40, 50],
      [342, -50]
    ])
  })

  test('dragging the start moves the layer to it', () => {
    const graph = new SceneGraph()
    const line = arrow(graph, { x: 0, y: 0 }, { x: 200, y: 0 })
    const result = drag(graph, line, 'start', { x: -30, y: 110 })
    expect(result.ends).toEqual([
      [-30, 110],
      [200, 0]
    ])
  })

  test('a vertical line keeps its axis and turns', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const line = graph.createNode('LINE', page, { width: 0, height: 160 })
    const result = drag(graph, line, 'end', { x: 72, y: 40 })
    expect(result.ends).toEqual([
      [0, 0],
      [72, 200]
    ])
    expect([result.aimed.width, result.length, result.rotation]).toEqual([0, 212.57, -19.8])
  })

  test('only a layer with one zero side is a line', () => {
    expect(isLineLike({ width: 200, height: 0 })).toBe(true)
    expect(isLineLike({ width: 0, height: 160 })).toBe(true)
    expect(isLineLike({ width: 80, height: 60 })).toBe(false)
    expect(isLineLike({ width: 0, height: 0 })).toBe(false)
  })
})

test('the editor aims a line from a dragged end in one undo step', () => {
  const editor = createEditor()
  const line = editor.graph.createNode('LINE', editor.state.currentPageId, {
    width: 200,
    height: 0
  })
  editor.lineEndBegin(line.id, 'end', 200, 0)
  editor.lineEndDrag(200, 100)
  editor.lineEndDrag(200, 200, { shift: true })
  editor.lineEndCommit()
  const aimed = editor.graph.getNode(line.id)
  expect(
    lineWorldEnds(editor.graph, aimed ?? line).map(({ x, y }) => [Math.round(x), Math.round(y)])
  ).toEqual([
    [0, 0],
    [200, 200]
  ])
  editor.undoAction()
  expect(editor.graph.getNode(line.id)).toMatchObject({ width: 200, height: 0, rotation: 0 })
  editor.dispose()
})

test('a connector is never aimed as a line, though its box is flat', () => {
  const editor = createEditor()
  const page = editor.state.currentPageId
  const connector = createConnector(editor.graph, page, {
    start: freeEndpoint(0, 0),
    end: freeEndpoint(200, 0)
  })
  editor.graph.updateNode(connector.id, { width: 200, height: 0 })
  editor.lineEndBegin(connector.id, 'end', 200, 0)
  editor.lineEndDrag(200, 100)
  editor.lineEndCommit()
  expect(editor.graph.getNode(connector.id)).toMatchObject({ width: 200, height: 0, rotation: 0 })
  editor.dispose()
})
