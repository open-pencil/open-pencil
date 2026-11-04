import { afterEach, describe, expect, mock, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { finishPencilDrag, handlePencilDragMove, startPencilInput } from '#vue/canvas/pencil/input'

let editor: Editor

afterEach(() => editor.dispose())

function setup() {
  editor = createEditor()
  editor.setTool('PENCIL')
  return editor.state.currentPageId
}

function frame(parentId: string, props: Partial<SceneNode>) {
  return editor.graph.createNode('FRAME', parentId, props)
}

/** Draws through canvas points and returns the parent the stroke went into. */
function stroke(points: Vector[]) {
  const [first, ...rest] = points
  startPencilInput(first.x, first.y, editor, mock())
  for (const point of rest) handlePencilDragMove(point.x, point.y, false, editor)
  const before = new Set([...editor.graph.getAllNodes()].map((node) => node.id))
  finishPencilDrag(editor)
  const vector = [...editor.graph.getAllNodes()].find(
    (node) => node.type === 'VECTOR' && !before.has(node.id)
  )
  if (!vector?.parentId) throw new Error('Expected a pencil stroke')
  return vector.parentId
}

function wave(x0: number, y0: number, length: number) {
  return Array.from({ length: 21 }, (_, i) => ({
    x: x0 + (length * i) / 20,
    y: y0 + 10 * Math.sin((i / 20) * 2 * Math.PI)
  }))
}

/** Canvas points for points in a layer's own axes. */
function inLayer(layer: SceneNode, points: Vector[]): Vector[] {
  const world = Matrix.mapPoints(
    getWorldMatrix(layer, editor.graph),
    points.flatMap((point) => [point.x, point.y])
  )
  return points.map((_, i) => ({ x: world[2 * i], y: world[2 * i + 1] }))
}

// Measured in Figma desktop: a stroke goes into the frame that holds all of it.
describe('pencil parent', () => {
  test('goes into the frame that holds the whole stroke', () => {
    const page = setup()
    const host = frame(page, { x: 0, y: 0, width: 400, height: 200 })
    expect(stroke(wave(50, 100, 300))).toBe(host.id)
  })

  test('goes onto the page when the stroke leaves the frame it started in', () => {
    const page = setup()
    frame(page, { x: 0, y: 0, width: 200, height: 200 })
    expect(stroke(wave(50, 100, 300))).toBe(page)
  })

  test('goes into the outer frame when it leaves the inner one', () => {
    const page = setup()
    const outer = frame(page, { x: 0, y: 0, width: 600, height: 400 })
    frame(outer.id, { x: 20, y: 20, width: 150, height: 150 })
    expect(stroke(wave(50, 100, 300))).toBe(outer.id)
  })

  test('checks a rotated frame by its own box, not the box around it', () => {
    const page = setup()
    const band = frame(page, { x: 200, y: 100, width: 300, height: 40, rotation: 45 })
    expect(
      stroke(
        inLayer(
          band,
          wave(20, 20, 260).map((p) => ({ x: p.x, y: 20 }))
        )
      )
    ).toBe(band.id)
    // Leaves the band sideways while staying inside its axis-aligned bounds.
    expect(
      stroke(
        inLayer(band, [
          { x: 150, y: 20 },
          { x: 150, y: 60 },
          { x: 150, y: 90 }
        ])
      )
    ).toBe(page)
  })
})
