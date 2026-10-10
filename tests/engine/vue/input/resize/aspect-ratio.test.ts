import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

import { applyResize, commitResizePreview } from '#vue/shared/input/resize'
import { tryStartResize } from '#vue/shared/input/resize/start'
import type { DragResize } from '#vue/shared/input/types'

// Handle drags recorded in live Figma, 2026-10-10, on a 200×100 rectangle at 200,150.
const HANDLES: Record<DragResize['handle'], [number, number]> = {
  nw: [0, 0],
  n: [0.5, 0],
  ne: [1, 0],
  e: [1, 0.5],
  se: [1, 1],
  s: [0.5, 1],
  sw: [0, 1],
  w: [0, 0.5]
}

function drag(
  handle: DragResize['handle'],
  dx: number,
  dy: number,
  { locked = true, shift = false, ctrl = false } = {}
) {
  const editor = createEditor()
  editor.state.snappingPreferences = { geometry: false, objects: false, pixelGrid: false }
  const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
    x: 200,
    y: 150,
    width: 200,
    height: 100,
    targetAspectRatio: locked ? { x: 200, y: 100 } : null
  })
  editor.select([node.id])
  const [fx, fy] = HANDLES[handle]
  const startX = 200 + fx * 200
  const startY = 150 + fy * 100
  const state = tryStartResize(startX, startY, editor)
  if (!state) throw new Error(`No ${handle} handle at ${startX},${startY}`)
  applyResize(state, startX + dx, startY + dy, shift, editor, ctrl)
  commitResizePreview(state, editor)
  return { editor, node: editor.graph.getNode(node.id) as SceneNode }
}

function box(node: SceneNode) {
  return { x: node.x, y: node.y, width: node.width, height: node.height }
}

describe('resizing a locked layer on the canvas', () => {
  test('a corner follows the axis the pointer changed most', () => {
    expect(box(drag('se', 100, 10).node)).toEqual({ x: 200, y: 150, width: 300, height: 150 })
    expect(box(drag('se', 10, 100).node)).toEqual({ x: 200, y: 150, width: 400, height: 200 })
    expect(box(drag('se', 60, 40).node)).toEqual({ x: 200, y: 150, width: 280, height: 140 })
    expect(box(drag('nw', -100, -10).node)).toEqual({ x: 100, y: 100, width: 300, height: 150 })
  })

  test('an edge sizes the other axis around its centre', () => {
    expect(box(drag('e', 100, 0).node)).toEqual({ x: 200, y: 125, width: 300, height: 150 })
    expect(box(drag('s', 0, 50).node)).toEqual({ x: 150, y: 150, width: 300, height: 150 })
  })

  test('the lock keeps the stored size, and Shift adds nothing', () => {
    const { node } = drag('se', 100, 10, { shift: true })
    expect(box(node)).toEqual({ x: 200, y: 150, width: 300, height: 150 })
    expect(node.targetAspectRatio).toEqual({ x: 200, y: 100 })
  })

  test('Control frees the lock and the new size becomes the ratio, in one undo step', () => {
    const { editor, node } = drag('se', 100, 10, { ctrl: true })
    expect(box(node)).toEqual({ x: 200, y: 150, width: 300, height: 110 })
    expect(node.targetAspectRatio).toEqual({ x: 300, y: 110 })

    editor.undo.undo()
    const restored = editor.graph.getNode(node.id) as SceneNode
    expect(box(restored)).toEqual({ x: 200, y: 150, width: 200, height: 100 })
    expect(restored.targetAspectRatio).toEqual({ x: 200, y: 100 })
  })

  test('Shift keeps the ratio of an unlocked layer for one drag', () => {
    const unlocked = { locked: false, shift: true }
    expect(box(drag('e', 100, 0, unlocked).node)).toEqual({
      x: 200,
      y: 125,
      width: 300,
      height: 150
    })
    const { node } = drag('se', 60, 40, unlocked)
    expect(box(node)).toEqual({ x: 200, y: 150, width: 280, height: 140 })
    expect(node.targetAspectRatio).toBeNull()
    expect(box(drag('se', 100, 10, { locked: false }).node)).toEqual({
      x: 200,
      y: 150,
      width: 300,
      height: 110
    })
  })
})
