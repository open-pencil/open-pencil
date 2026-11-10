import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import { applyScale, tryStartScale, type ScaleModifiers } from '#vue/shared/input/scale'
import { handleScaleDown, type HitTestFns } from '#vue/shared/input/select'
import type { DragState } from '#vue/shared/input/types'

let editor: Editor

afterEach(() => editor.dispose())

const PLAIN: ScaleModifiers = { centred: false, disableSnapping: false }

function current(id: string) {
  const node = editor.graph.getNode(id)
  if (!node) throw new Error('missing layer')
  return node
}

/** A selected 200×100 frame at the origin, with text and a stroke, beside an optional layer. */
function card(neighbour?: Rect) {
  editor = createEditor()
  editor.state.snappingPreferences = { geometry: true, objects: true, pixelGrid: true }
  const page = editor.state.currentPageId
  const frame = editor.graph.createNode('FRAME', page, { width: 200, height: 100, strokeWeight: 2 })
  const text = editor.graph.createNode('TEXT', frame.id, { x: 10, y: 10, text: 'Hi', fontSize: 20 })
  if (neighbour) editor.graph.createNode('RECTANGLE', page, neighbour)
  editor.select([frame.id])
  return { frame, text }
}

function scaleFrom(
  frame: SceneNode,
  at: Vector,
  dx: number,
  dy: number,
  modifiers = PLAIN
) {
  const drag = tryStartScale(at.x, at.y, editor)
  if (!drag) throw new Error('No handle')
  applyScale(drag, at.x + dx, at.y + dy, editor, modifiers)
  drag.commit()
  const { x, y, width, height } = current(frame.id)
  return { x, y, width, height }
}

// Drags on a 200×100 frame in live Figma's Scale tool, 2026-11-11.
describe('Scale tool drags, as measured in Figma', () => {
  test('a corner follows the axis that changed most and keeps the opposite corner', () => {
    const { frame, text } = card()
    expect(scaleFrom(frame, { x: 200, y: 100 }, 100, 20)).toEqual({
      x: 0,
      y: 0,
      width: 300,
      height: 150
    })
    expect(current(text.id).fontSize).toBe(30)
    expect(current(frame.id).strokeWeight).toBe(3)
  })

  test('an edge scales from the middle of the opposite edge', () => {
    const { frame } = card()
    expect(scaleFrom(frame, { x: 200, y: 50 }, 100, 0)).toEqual({
      x: 0,
      y: -25,
      width: 300,
      height: 150
    })
  })

  test('Alt scales from the center', () => {
    const { frame } = card()
    const centred = { centred: true, disableSnapping: false }
    expect(scaleFrom(frame, { x: 200, y: 100 }, 50, 10, centred)).toEqual({
      x: -50,
      y: -25,
      width: 300,
      height: 150
    })
    expect(editor.state.scaleAnchor).toEqual({ x: 0.5, y: 0.5 })
  })

  test('sizes are not rounded to whole pixels', () => {
    const { frame } = card()
    expect(scaleFrom(frame, { x: 200, y: 100 }, 37, 0)).toMatchObject({ width: 237, height: 118.5 })
  })

  test("the dragged edge snaps to another layer's edge, unless Control is held", () => {
    const neighbour = { x: 260, y: 300, width: 40, height: 40 }
    const { frame } = card(neighbour)
    expect(scaleFrom(frame, { x: 200, y: 100 }, 57, 0)).toMatchObject({ width: 260, height: 130 })
    editor.dispose()
    const free = card(neighbour)
    expect(
      scaleFrom(free.frame, { x: 200, y: 100 }, 57, 0, { centred: false, disableSnapping: true })
    ).toMatchObject({ width: 257 })
  })

  test('the anchor moves to the point the drag kept in place', () => {
    const { frame } = card()
    scaleFrom(frame, { x: 200, y: 50 }, 100, 0)
    expect(editor.state.scaleAnchor).toEqual({ x: 0, y: 0.5 })
  })
})

describe('Scale tool input', () => {
  test('cancelling puts the layer back', () => {
    const { frame, text } = card()
    const drag = tryStartScale(200, 100, editor)
    if (!drag) throw new Error('No handle')
    applyScale(drag, 300, 150, editor, PLAIN)
    drag.cancel()
    expect(current(frame.id)).toMatchObject({ x: 0, y: 0, width: 200 })
    expect(current(text.id).fontSize).toBe(20)
  })

  test('leaves a locked layer inside as it is while dragging', () => {
    const { frame } = card()
    const locked = editor.graph.createNode('RECTANGLE', frame.id, {
      x: 100,
      y: 50,
      width: 40,
      height: 20,
      locked: true
    })
    const drag = tryStartScale(200, 100, editor)
    if (!drag) throw new Error('No handle')
    applyScale(drag, 300, 150, editor, PLAIN)
    expect(current(locked.id)).toMatchObject({ x: 100, y: 50, width: 40 })
    drag.commit()
    expect(current(locked.id)).toMatchObject({ x: 100, y: 50, width: 40 })
  })

  test('scales a turned layer from its own corner, keeping its angle', () => {
    editor = createEditor()
    const rect = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      width: 200,
      height: 100,
      rotation: 30
    })
    editor.select([rect.id])
    const world = () => getWorldMatrix(current(rect.id), editor.graph)
    const [ax, ay, cx, cy] = Matrix.mapPoints(world(), [0, 0, 200, 100])
    const drag = tryStartScale(cx, cy, editor)
    if (!drag) throw new Error('No handle on the turned corner')
    applyScale(drag, cx + 40, cy, editor, { centred: false, disableSnapping: true })
    drag.commit()

    const scaled = current(rect.id)
    expect(scaled.rotation).toBeCloseTo(30)
    expect(scaled.width / scaled.height).toBeCloseTo(2)
    expect(scaled.width).toBeGreaterThan(200)
    const [bx, by] = Matrix.mapPoints(world(), [0, 0])
    expect(bx).toBeCloseTo(ax)
    expect(by).toBeCloseTo(ay)
  })

  test('scales layers in one parent together about their box', () => {
    editor = createEditor()
    const page = editor.state.currentPageId
    const left = editor.graph.createNode('RECTANGLE', page, { width: 50, height: 50 })
    const right = editor.graph.createNode('RECTANGLE', page, { x: 150, y: 50, width: 50, height: 50 })
    editor.select([left.id, right.id])

    const drag = tryStartScale(200, 100, editor)
    if (!drag) throw new Error('No handle')
    applyScale(drag, 300, 150, editor, PLAIN)
    drag.commit()

    expect(current(left.id)).toMatchObject({ x: 0, y: 0, width: 75 })
    expect(current(right.id)).toMatchObject({ x: 225, y: 75, width: 75 })
  })

  test("a line's end scales it from the other end", () => {
    editor = createEditor()
    const line = editor.graph.createNode('LINE', editor.state.currentPageId, {
      width: 100,
      height: 0,
      strokeWeight: 2
    })
    editor.select([line.id])
    const drag = tryStartScale(100, 0, editor)
    if (!drag) throw new Error('No end handle')
    applyScale(drag, 150, 0, editor, PLAIN)
    drag.commit()
    expect(current(line.id)).toMatchObject({ x: 0, width: 150, strokeWeight: 3 })
  })

  test('a multi-selection with a locked layer scales about the box its handles show', () => {
    editor = createEditor()
    const page = editor.state.currentPageId
    const free = editor.graph.createNode('RECTANGLE', page, { width: 50, height: 50 })
    const locked = editor.graph.createNode('RECTANGLE', page, {
      x: 150,
      y: 50,
      width: 50,
      height: 50,
      locked: true
    })
    editor.select([free.id, locked.id])

    // The 200×100 box scales 1.5× from its top-left; only the unlocked layer changes.
    const drag = tryStartScale(200, 100, editor)
    if (!drag) throw new Error('No handle')
    applyScale(drag, 300, 150, editor, PLAIN)
    drag.commit()

    expect(current(free.id)).toMatchObject({ x: 0, y: 0, width: 75 })
    expect(current(locked.id)).toMatchObject({ x: 150, width: 50 })
  })

  test('a press on the layer itself moves it, as the Move tool would', () => {
    const { frame } = card()
    const fns: HitTestFns = {
      hitTestLayer: () => frame,
      hitTestFrameTitle: () => null,
      hitTestSectionTitle: () => null,
      hitTestComponentLabel: () => null
    }
    let drag: DragState | null = null
    const press = { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false } as MouseEvent
    handleScaleDown(press, 100, 50, 100, 50, editor, fns, (next) => {
      drag = next
    })
    expect(drag).toMatchObject({ type: 'move' })
  })
})
