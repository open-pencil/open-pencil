import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor, type Tool } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

import { handleDrawMove, startShapeDraw } from '#vue/shared/input/draw'
import type { DragState } from '#vue/shared/input/types'

// Each case replays a drawing observed in Figma desktop 126 with real pointer input.

let editor: Editor

afterEach(() => editor.dispose())

function setup() {
  editor = createEditor()
  return editor.state.currentPageId
}

function node(type: SceneNode['type'], parentId: string, props: Partial<SceneNode> = {}) {
  return editor.graph.createNode(type, parentId, { width: 40, height: 40, ...props })
}

function draw(tool: Tool, from: [number, number], to: [number, number] = from) {
  editor.setTool(tool)
  let drag: DragState | null = null
  startShapeDraw(from[0], from[1], editor, (d) => {
    drag = d
  })
  const drawing = drag as DragState | null
  if (drawing?.type !== 'draw') throw new Error('Expected a drawing')
  if (to !== from) handleDrawMove(drawing, to[0], to[1], false)
  drawing.commit()
  const created = editor.graph.getNode(drawing.nodeId)
  if (!created) throw new Error('Expected a drawn layer')
  return created
}

describe('drawing into containers', () => {
  test('puts the layer in the frame under the start point, even when it ends outside', () => {
    const page = setup()
    const frame = node('FRAME', page, { x: 100, y: 100, width: 200, height: 200 })
    const rect = draw('RECTANGLE', [250, 250], [400, 400])
    expect(rect.parentId).toBe(frame.id)
    expect(rect).toMatchObject({ x: 150, y: 150, width: 150, height: 150 })
  })

  test('adds the layer to the end of an auto layout flow', () => {
    const page = setup()
    const row = node('FRAME', page, {
      width: 300,
      height: 100,
      layoutMode: 'HORIZONTAL',
      itemSpacing: 10,
      paddingLeft: 10,
      paddingTop: 10
    })
    node('RECTANGLE', row.id, { width: 60, height: 60 })
    const rect = draw('RECTANGLE', [150, 20], [190, 60])
    expect(rect.parentId).toBe(row.id)
    expect(rect).toMatchObject({ x: 80, y: 10 })
  })

  test('skips groups and locked frames', () => {
    const page = setup()

    node('GROUP', page, { x: 500, width: 200, height: 200 })
    expect(draw('RECTANGLE', [550, 50], [580, 80]).parentId).toBe(page)

    node('FRAME', page, { x: 800, width: 200, height: 200, locked: true })
    expect(draw('RECTANGLE', [850, 50], [880, 80]).parentId).toBe(page)
  })

  test('draws in the axes of a rotated frame', () => {
    const page = setup()
    const frame = node('FRAME', page, { width: 200, height: 200, rotation: 90 })
    const rect = draw('RECTANGLE', [100, 100], [150, 150])
    expect(rect.parentId).toBe(frame.id)
    expect(rect.width).toBeCloseTo(50)
    expect(rect.height).toBeCloseTo(50)
  })

  test('a drawn frame adopts the unlocked layers it fully covers', () => {
    const page = setup()
    const covered = node('RECTANGLE', page, { x: 20, y: 20 })
    const partial = node('RECTANGLE', page, { x: 120, y: 120, width: 60, height: 60 })
    const locked = node('RECTANGLE', page, { x: 60, y: 20, locked: true })
    const section = node('SECTION', page, { x: 20, y: 80, width: 30, height: 30 })
    const frame = draw('FRAME', [-20, -20], [150, 150])
    expect(covered.parentId).toBe(frame.id)
    expect(editor.graph.getAbsolutePosition(covered.id)).toEqual({ x: 20, y: 20 })
    expect(partial.parentId).toBe(page)
    expect(locked.parentId).toBe(page)
    expect(section.parentId).toBe(page)

    editor.undoAction()
    expect(covered.parentId).toBe(page)
    expect(editor.graph.getNode(frame.id)).toBeUndefined()
  })

  test('a frame made by a click adopts nothing', () => {
    const page = setup()
    const small = node('RECTANGLE', page, { x: 10, y: 10, width: 10, height: 10 })
    draw('FRAME', [0, 0])
    expect(small.parentId).toBe(page)
  })

  test('a drawn rectangle adopts nothing', () => {
    const page = setup()
    const covered = node('RECTANGLE', page, { x: 20, y: 20 })
    draw('RECTANGLE', [-20, -20], [150, 150])
    expect(covered.parentId).toBe(page)
  })
})
