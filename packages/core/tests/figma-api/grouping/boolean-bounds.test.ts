import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import type { Surface } from 'canvaskit-wasm'

import { createEditor } from '@open-pencil/core'
import { SkiaRenderer } from '@open-pencil/core/canvas'
import { FigmaAPI, type FigmaNodeProxy } from '@open-pencil/core/figma-api'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { makeBooleanOperationPath } from '#core/canvas/boolean'

// Recorded with the same script in Figma desktop 126: a boolean operation takes the box of its
// result, and an empty result keeps its operands' box. Measuring needs a renderer.

type Operation = 'union' | 'subtract' | 'intersect' | 'exclude'

let renderer: SkiaRenderer
let surface: Surface

beforeAll(async () => {
  const ck = await initCanvasKit()
  const made = ck.MakeSurface(64, 64)
  if (!made) throw new Error('Could not create CanvasKit surface')
  surface = made
  renderer = new SkiaRenderer(ck, surface)
})

afterAll(() => surface.delete())

const box = (node: Rect) =>
  [node.x, node.y, node.width, node.height].map((value) => Math.round(value * 1000) / 1000)

function api() {
  const figma = new FigmaAPI(new SceneGraph())
  figma.setRenderer(renderer)
  const square = (x: number, y: number, width = 50, height = 50) => {
    const rect = figma.createRectangle()
    rect.x = x
    rect.y = y
    rect.resize(width, height)
    return rect
  }
  return { figma, square }
}

describe('boolean operation bounds', () => {
  test('from scripts, a boolean takes the box of its result', () => {
    const { figma, square } = api()
    const combine = (operation: Operation, ...nodes: FigmaNodeProxy[]) =>
      figma[operation](nodes, figma.currentPage)
    expect(box(combine('union', square(0, 0), square(20, 20)))).toEqual([0, 0, 70, 70])
    expect(box(combine('subtract', square(0, 0), square(20, 20)))).toEqual([0, 0, 50, 50])
    const intersect = combine('intersect', square(0, 0), square(20, 20))
    expect(box(intersect)).toEqual([20, 20, 30, 30])
    // The operands keep their places in the container's space.
    expect(intersect.children.map((child) => [child.x, child.y])).toEqual([
      [0, 0],
      [20, 20]
    ])
    expect(box(combine('subtract', square(0, 0), square(25, -10, 50, 70)))).toEqual([0, 0, 25, 50])
    expect(box(combine('intersect', square(0, 0), square(100, 0)))).toEqual([0, 0, 150, 50])
  })

  test('moving an operand refits the boolean to its new result', () => {
    const { figma, square } = api()
    const moving = square(20, 20)
    const intersect = figma.intersect([square(0, 0), moving], figma.currentPage)
    moving.x = 40
    expect(box(intersect)).toEqual([40, 20, 10, 30])
  })

  test('from the canvas, a boolean takes the box of its result too', () => {
    const editor = createEditor()
    // Attaching CanvasKit installs a global text measurer that later tests must not inherit.
    try {
      editor.setCanvasKit(renderer.ck, renderer)
      const pageId = editor.state.currentPageId
      const a = editor.graph.createNode('RECTANGLE', pageId, { width: 50, height: 50 })
      const b = editor.graph.createNode('RECTANGLE', pageId, {
        x: 20,
        y: 20,
        width: 50,
        height: 50
      })
      editor.select([a.id, b.id])
      editor.booleanOperationSelected('INTERSECT')
      const [booleanId] = [...editor.state.selectedIds]
      const booleanNode = editor.graph.getNode(booleanId ?? '')
      expect(booleanNode && box(booleanNode)).toEqual([20, 20, 30, 30])
      expect(editor.graph.getAbsolutePosition(b.id)).toEqual({ x: 20, y: 20 })

      // The operation itself changing drops the renderer's kept result: the next reading is
      // built from the new operation.
      const resultSize = () => {
        const node = editor.graph.getNode(booleanId ?? '')
        const path = node && makeBooleanOperationPath(renderer, node, editor.graph)
        const bounds = path?.getBounds()
        path?.delete()
        return bounds && [bounds[2] - bounds[0], bounds[3] - bounds[1]].map(Math.round)
      }
      expect(resultSize()).toEqual([30, 30])
      editor.updateNode(booleanId ?? '', { booleanOperation: 'UNION' })
      expect(resultSize()).toEqual([70, 70])
      // And the boolean takes the box of that result, as it does when an operand moves.
      expect(booleanNode && box(booleanNode)).toEqual([0, 0, 70, 70])
    } finally {
      editor.dispose()
    }
  })

  test('undo puts back the group a boolean refit', () => {
    const editor = createEditor()
    try {
      editor.setCanvasKit(renderer.ck, renderer)
      const pageId = editor.state.currentPageId
      const group = editor.graph.createNode('GROUP', pageId, { width: 200, height: 70 })
      const a = editor.graph.createNode('RECTANGLE', group.id, { width: 50, height: 50 })
      const b = editor.graph.createNode('RECTANGLE', group.id, {
        x: 20,
        y: 20,
        width: 50,
        height: 50
      })
      editor.graph.createNode('RECTANGLE', group.id, { x: 150, y: 0, width: 50, height: 50 })
      const before = [a, b].map((node) => editor.graph.getAbsolutePosition(node.id))

      editor.select([a.id, b.id])
      editor.booleanOperationSelected('INTERSECT')
      editor.undo.undo()

      expect(box(group)).toEqual([0, 0, 200, 70])
      expect([a, b].map((node) => editor.graph.getAbsolutePosition(node.id))).toEqual(before)
    } finally {
      editor.dispose()
    }
  })
})
