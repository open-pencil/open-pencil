import { afterEach, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core/editor'
import { boundEndpoint, createConnector, createSticky, type SceneNode } from '@open-pencil/scene-graph'

import {
  MOVE_CURSOR,
  cornerRotationCursor,
  getHitHandleByMatrix,
  buildResizeCursor
} from '#vue/shared/input/geometry'
import { updateHoverCursor } from '#vue/shared/input/select/hover'

let editor: Editor

afterEach(() => editor.dispose())

/** A selected 240×160 frame at the origin, viewed at 100%, with its label under every point. */
function selectedFrame(labelled: boolean) {
  editor = createEditor()
  const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
    width: 240,
    height: 160
  })
  editor.select([frame.id])
  const fns = {
    hitTestInScope: () => null,
    hitTestFrameTitle: (): SceneNode | null => (labelled ? frame : null),
    hitTestSectionTitle: () => null,
    hitTestComponentLabel: () => null
  }
  return { frame, cursorAt: (x: number, y: number) => updateHoverCursor(x, y, editor, fns) }
}

test('outside a corner rotates, unless a label is there, as in Figma', () => {
  const plain = selectedFrame(false)
  expect(plain.cursorAt(-9, -6)).toBe(cornerRotationCursor('nw', plain.frame, editor.graph))
  editor.dispose()
  const labelled = selectedFrame(true)
  expect(labelled.cursorAt(-9, -6)).toBeNull()
})

test('a label does not take the press from a resize band', () => {
  const { frame, cursorAt } = selectedFrame(true)
  const hit = getHitHandleByMatrix(-3, -3, frame, editor.graph)
  expect(hit?.handle).toBe('nw')
  expect(cursorAt(-3, -3)).toBe(buildResizeCursor(hit?.rotation ?? 0))
  expect(getHitHandleByMatrix(120, -5, frame, editor.graph)?.handle).toBe('n')
})

const NO_HITS = {
  hitTestInScope: () => null,
  hitTestFrameTitle: () => null,
  hitTestSectionTitle: () => null,
  hitTestComponentLabel: () => null
}

test('a connector has no resize cursor, its end handles included, as in FigJam', () => {
  editor = createEditor()
  const page = editor.state.currentPageId
  const a = editor.graph.createNode('RECTANGLE', page, { x: 0, y: 0, width: 100, height: 100 })
  const b = editor.graph.createNode('RECTANGLE', page, { x: 300, y: 0, width: 100, height: 100 })
  const connector = createConnector(editor.graph, page, {
    start: boundEndpoint(a.id),
    end: boundEndpoint(b.id)
  })
  editor.graph.updateNode(connector.id, { x: 100, y: 30, width: 200, height: 40 })
  editor.select([connector.id])
  expect(getHitHandleByMatrix(300, 50, connector, editor.graph)?.handle).toBe('e')
  expect(updateHoverCursor(300, 50, editor, NO_HITS)).toBeNull()
})

test("a sticky note's handles keep their cursor, since they scale it", () => {
  editor = createEditor()
  const sticky = createSticky(editor.graph, editor.state.currentPageId, { text: '' })
  editor.select([sticky.id])
  const hit = getHitHandleByMatrix(sticky.width, sticky.height, sticky, editor.graph)
  expect(hit?.handle).toBe('se')
  expect(updateHoverCursor(sticky.width, sticky.height, editor, NO_HITS)).toBe(
    buildResizeCursor(hit?.rotation ?? 0)
  )
})

test("a line's ends show the move cursor, and its length takes no resize", () => {
  editor = createEditor()
  const line = editor.graph.createNode('LINE', editor.state.currentPageId, { width: 200, height: 0 })
  editor.select([line.id])
  expect(updateHoverCursor(200, 0, editor, NO_HITS)).toBe(MOVE_CURSOR)
  expect(updateHoverCursor(0, 2, editor, NO_HITS)).toBe(MOVE_CURSOR)
  expect(updateHoverCursor(100, 3, editor, NO_HITS)).toBeNull()
})

