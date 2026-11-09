import { afterEach, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import type { VectorSegment } from '@open-pencil/scene-graph'

import { expectDefined } from '@open-pencil/test-support/assert'

let editor: Editor

afterEach(() => editor.dispose())

function closedPath() {
  const [id] = editor.state.selectedIds
  const network = expectDefined(editor.graph.getNode(expectDefined(id))?.vectorNetwork)
  return {
    segments: network.segments.map(({ start, end, tangentStart, tangentEnd }: VectorSegment) => ({
      start,
      end,
      tangentStart,
      tangentEnd
    })),
    regions: network.regions.length
  }
}

test('closes a two-point path into two segments', () => {
  editor = createEditor()
  editor.setTool('PEN')
  editor.penAddVertex(0, 0)
  editor.penAddVertex(100, 0)
  editor.penSetDragTangent(0, 60)
  editor.penSetPendingClose(true)
  editor.penCommit(true)

  const { segments, regions } = closedPath()
  expect(segments.map(({ start, end }) => [start, end])).toEqual([
    [0, 1],
    [1, 0]
  ])
  expect(regions).toBe(1)
})

test("starts the closing segment along the last point's handle", () => {
  editor = createEditor()
  editor.setTool('PEN')
  editor.penAddVertex(0, 0)
  editor.penAddVertex(100, 0)
  editor.penAddVertex(100, 100)
  editor.penSetDragTangent(-30, 30)
  editor.penSetPendingClose(true)
  editor.penCommit(true)

  const closing = expectDefined(closedPath().segments.at(-1))
  expect(closing.tangentStart).toEqual({ x: -30, y: 30 })
  expect(closing.tangentEnd).toEqual({ x: 0, y: 0 })
})

// Figma desktop 126: the drag points the way the path carries on past its first point, so the
// closing segment arrives along its mirror and the first segment keeps its own handle.
test('closes along the mirror of a drag at the first point, keeping the last handle', () => {
  editor = createEditor()
  editor.setTool('PEN')
  editor.penAddVertex(0, 0)
  editor.penSetDragTangent(0, -60)
  editor.penAddVertex(100, 0)
  editor.penAddVertex(100, 100)
  editor.penSetDragTangent(-30, 30)
  editor.penSetPendingClose(true)
  editor.penSetDragTangent(10, 40)
  editor.penCommit(true)

  const { segments } = closedPath()
  expect(segments[0]?.tangentStart).toEqual({ x: 0, y: -60 })
  expect(segments.at(-1)?.tangentStart).toEqual({ x: -30, y: 30 })
  expect(segments.at(-1)?.tangentEnd).toEqual({ x: -10, y: -40 })
})

test('keeps the closing handles in line with the first point while ⌘ is held', () => {
  editor = createEditor()
  editor.setTool('PEN')
  editor.penAddVertex(0, 0)
  editor.penSetDragTangent(30, -40)
  editor.penAddVertex(100, 0)
  editor.penAddVertex(100, 100)
  editor.penSetPendingClose(true)
  editor.penSetDragTangent(10, -60, { keepOpposite: true, constrainToOpposite: true })
  editor.penCommit(true)

  // The handle into the first point points straight away from the one leaving it.
  const into = expectDefined(closedPath().segments.at(-1)?.tangentEnd)
  expect(into.x * -40 - into.y * 30).toBeCloseTo(0)
  expect(into.x * 30 + into.y * -40).toBeLessThan(0)
})

test('gives the last handle back to the next segment when the path does not close', () => {
  editor = createEditor()
  editor.setTool('PEN')
  editor.penAddVertex(0, 0)
  editor.penAddVertex(100, 0)
  editor.penSetDragTangent(0, 50)
  editor.penSetPendingClose(true)
  editor.penSetPendingClose(false)
  editor.penAddVertex(100, 100)

  expect(editor.state.penState?.segments.at(-1)?.tangentStart).toEqual({ x: 0, y: 50 })
})

test('closes along the last handle when asked to close without a press on the first point', () => {
  editor = createEditor()
  editor.setTool('PEN')
  editor.penAddVertex(0, 0)
  editor.penAddVertex(100, 0)
  editor.penAddVertex(100, 100)
  editor.penSetDragTangent(-30, 30)
  editor.penCommit(true)

  const { segments, regions } = closedPath()
  expect(segments.map(({ start, end }) => [start, end])).toEqual([
    [0, 1],
    [1, 2],
    [2, 0]
  ])
  expect(segments.at(-1)?.tangentStart).toEqual({ x: -30, y: 30 })
  expect(regions).toBe(1)
})
