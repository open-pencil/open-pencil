import { afterEach, describe, expect, test } from 'bun:test'

import type { Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'

import { handleMoveMove, handleMoveUp } from '#vue/shared/input/move/drag'
import { handleSelectDown, type HitTestFns } from '#vue/shared/input/select'
import type { DragState } from '#vue/shared/input/types'

import { createMoveHarness } from '../move/harness'

let editor: Editor

afterEach(() => editor.dispose())

interface Keys {
  altKey?: boolean
}

type Point = [number, number]

const SOLID_FILL = {
  type: 'SOLID',
  color: { r: 1, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  blendMode: 'NORMAL'
} as const

function setup() {
  const harness = createMoveHarness()
  editor = harness.editor
  const rect = harness.node('RECTANGLE', harness.page, { x: 300, y: 300, width: 100, height: 100 })
  const other = harness.node('RECTANGLE', harness.page, { x: 600, y: 300, width: 100, height: 100 })
  let stubbedHit: SceneNode | null = null
  const fns: HitTestFns = {
    hitTestLayer: (cx, cy) =>
      stubbedHit ??
      editor.graph.hitTestSelectable(cx, cy, harness.page, editor.state.selectedIds, {}),
    hitTestFrameTitle: () => null,
    hitTestSectionTitle: () => null,
    hitTestComponentLabel: () => null
  }

  function shiftPress(target: SceneNode | null, at: Point, keys: Keys = {}) {
    stubbedHit = target
    let drag: DragState | null = null
    const event = { shiftKey: true, altKey: keys.altKey ?? false, metaKey: false, ctrlKey: false }
    handleSelectDown(
      event as MouseEvent,
      at[0],
      at[1],
      at[0],
      at[1],
      editor,
      fns,
      () => false,
      () => false,
      (next) => {
        drag = next
      }
    )
    return drag as DragState | null
  }

  function shiftDrag(target: SceneNode | null, from: Point, to: Point, keys: Keys = {}) {
    const drag = shiftPress(target, from, keys)
    if (drag?.type !== 'move') {
      throw new Error('Expected a move drag')
    }
    handleMoveMove(drag, to[0], to[1], to[0], to[1], editor, { shiftKey: true })
    handleMoveUp(drag, editor)
  }

  function shiftClick(target: SceneNode | null, at: Point, keys: Keys = {}) {
    const drag = shiftPress(target, at, keys)
    const selectedWhilePressed = [...editor.state.selectedIds]
    if (drag?.type === 'move') {
      handleMoveUp(drag, editor)
    }
    return selectedWhilePressed
  }

  return { ...harness, rect, other, shiftPress, shiftDrag, shiftClick }
}

function nestedFrame(harness: ReturnType<typeof setup>) {
  const outer = harness.node('FRAME', harness.page, { x: 1000, y: 0, width: 1000, height: 1000 })
  const inner = harness.node('FRAME', outer.id, { x: 300, y: 300, width: 100, height: 100 })
  const content = harness.node('RECTANGLE', inner.id, {
    width: 100,
    height: 100,
    fills: [SOLID_FILL]
  })
  return { inner, content }
}

describe('Shift on a selected layer, as in Figma', () => {
  test('a drag moves it along one axis and keeps it selected', () => {
    const { rect, shiftDrag } = setup()
    editor.select([rect.id])
    shiftDrag(rect, [350, 350], [500, 380])
    expect(editor.graph.getNode(rect.id)).toMatchObject({ x: 450, y: 300 })
    expect([...editor.state.selectedIds]).toEqual([rect.id])
  })

  test('with Alt, a drag duplicates it along one axis', () => {
    const { rect, other, page, childIds, shiftDrag } = setup()
    editor.select([rect.id])
    shiftDrag(rect, [350, 350], [500, 380], { altKey: true })
    const copies = childIds(page).filter((id) => id !== rect.id && id !== other.id)
    expect(copies).toHaveLength(1)
    expect(editor.graph.getNode(copies[0])).toMatchObject({ x: 450, y: 300 })
    expect(editor.graph.getNode(rect.id)).toMatchObject({ x: 300, y: 300 })
    expect([...editor.state.selectedIds]).toEqual(copies)
  })

  test('a click keeps it selected while pressed and deselects it on release', () => {
    const { rect, other, shiftClick } = setup()
    editor.select([rect.id, other.id])
    expect(shiftClick(rect, [350, 350])).toEqual([rect.id, other.id])
    expect([...editor.state.selectedIds]).toEqual([other.id])
  })

  test('with Alt, a click leaves no copy and deselects it', () => {
    const { rect, other, page, childIds, shiftClick } = setup()
    editor.select([rect.id, other.id])
    shiftClick(rect, [350, 350], { altKey: true })
    expect(childIds(page)).toEqual([rect.id, other.id])
    expect([...editor.state.selectedIds]).toEqual([other.id])
  })

  test('a drag on a selected nested frame moves the frame, not the layer the press lands on', () => {
    const harness = setup()
    const { inner, content } = nestedFrame(harness)
    editor.select([inner.id])
    harness.shiftDrag(null, [1350, 350], [1500, 380])
    expect(editor.graph.getNode(inner.id)).toMatchObject({ x: 450, y: 300 })
    expect(editor.graph.getNode(content.id)).toMatchObject({ x: 0, y: 0 })
    expect([...editor.state.selectedIds]).toEqual([inner.id])
  })

  test('a click on a selected nested frame deselects the frame on release', () => {
    const harness = setup()
    const { inner } = nestedFrame(harness)
    editor.select([inner.id, harness.other.id])
    expect(harness.shiftClick(null, [1350, 350])).toEqual([inner.id, harness.other.id])
    expect([...editor.state.selectedIds]).toEqual([harness.other.id])
  })

  test('a short jitter that keeps an auto layout child in its slot counts as a click', () => {
    const { node, page, shiftPress } = setup()
    const row = node('FRAME', page, {
      x: 0,
      y: 600,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      itemSpacing: 10
    })
    const first = node('RECTANGLE', row.id, { width: 60, height: 40 })
    node('RECTANGLE', row.id, { width: 60, height: 40 })
    editor.runLayoutForNode(row.id)
    editor.select([first.id])
    const drag = shiftPress(first, [30, 620])
    if (drag?.type !== 'move') {
      throw new Error('Expected a move drag')
    }
    handleMoveMove(drag, 31, 620, 40, 620, editor, { shiftKey: true })
    expect(drag.dragStarted).toBe(true)
    handleMoveUp(drag, editor)
    expect(editor.state.selectedIds.size).toBe(0)
  })

  test('a jitter too small to move it counts as a click', () => {
    const { rect, other, shiftPress } = setup()
    editor.select([rect.id, other.id])
    const drag = shiftPress(rect, [350, 350])
    if (drag?.type !== 'move') {
      throw new Error('Expected a move drag')
    }
    handleMoveMove(drag, 350.4, 350, 354, 350, editor, { shiftKey: true })
    expect(drag.dragStarted).toBe(true)
    handleMoveUp(drag, editor)
    expect(editor.graph.getNode(rect.id)).toMatchObject({ x: 300, y: 300 })
    expect([...editor.state.selectedIds]).toEqual([other.id])
  })

  test('a short jitter that keeps a wrapped auto layout child in its slot counts as a click', () => {
    const { node, page, shiftPress } = setup()
    const row = node('FRAME', page, {
      x: 0,
      y: 600,
      width: 200,
      layoutMode: 'HORIZONTAL',
      layoutWrap: 'WRAP',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'HUG',
      itemSpacing: 10
    })
    const first = node('RECTANGLE', row.id, { width: 60, height: 40, fills: [SOLID_FILL] })
    node('RECTANGLE', row.id, { width: 60, height: 40, fills: [SOLID_FILL] })
    editor.runLayoutForNode(row.id)
    editor.select([first.id])
    const drag = shiftPress(first, [30, 620])
    if (drag?.type !== 'move') {
      throw new Error('Expected a move drag')
    }
    handleMoveMove(drag, 31, 620, 40, 620, editor, { shiftKey: true })
    expect(drag.dragStarted).toBe(true)
    handleMoveUp(drag, editor)
    expect(editor.state.selectedIds.size).toBe(0)
  })

  test('where layers only move, a drag moves it and a click deselects it on release', () => {
    const { rect, other, shiftDrag, shiftClick } = setup()
    editor.setHostRestrictions({ layerEdits: 'move' })
    editor.select([rect.id])
    shiftDrag(rect, [350, 350], [500, 380])
    expect(editor.graph.getNode(rect.id)).toMatchObject({ x: 450, y: 300 })
    expect([...editor.state.selectedIds]).toEqual([rect.id])
    editor.select([rect.id, other.id])
    expect(shiftClick(rect, [500, 350])).toEqual([rect.id, other.id])
    expect([...editor.state.selectedIds]).toEqual([other.id])
  })

  test('with a locked selection, a click deselects it at once', () => {
    const { rect, other, shiftPress } = setup()
    editor.graph.updateNode(rect.id, { locked: true })
    editor.graph.updateNode(other.id, { locked: true })
    editor.select([rect.id, other.id])
    expect(shiftPress(rect, [350, 350])).toBeNull()
    expect([...editor.state.selectedIds]).toEqual([other.id])
  })

  test('on a read-only document, a click deselects it at once', () => {
    const { rect, other, shiftPress } = setup()
    editor.select([rect.id, other.id])
    editor.setReadOnly(true)
    expect(shiftPress(rect, [350, 350])).toBeNull()
    expect([...editor.state.selectedIds]).toEqual([other.id])
  })
})

describe('Shift on an unselected layer', () => {
  test('a press adds it to the selection', () => {
    const { rect, other, shiftClick } = setup()
    editor.select([rect.id])
    expect(shiftClick(other, [650, 350])).toEqual([rect.id, other.id])
    expect([...editor.state.selectedIds]).toEqual([rect.id, other.id])
  })
})
