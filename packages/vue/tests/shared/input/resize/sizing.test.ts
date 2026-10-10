import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import { applyResize, cancelResizePreview, commitResizePreview } from '#vue/shared/input/resize'
import { tryStartResize } from '#vue/shared/input/resize/start'
import type { DragResize } from '#vue/shared/input/types'

// Handle drags on a Hug × Hug auto layout frame of two 100×100 frames at 200,150, recorded in
// live Figma on 2026-10-10: [x, y, width, height, horizontal sizing, vertical sizing].
const CASES: [DragResize["handle"], number, number, boolean, (number | string)[]][] = [
  ['e', 60, 0, false, [200, 150, 260, 100, 'FIXED', 'HUG']],
  ['s', 0, 40, false, [200, 150, 200, 140, 'HUG', 'FIXED']],
  ['se', 60, 40, false, [200, 150, 260, 140, 'FIXED', 'FIXED']],
  ['e', 60, 0, true, [200, 135, 260, 130, 'FIXED', 'FIXED']],
  ['s', 0, 40, true, [160, 150, 280, 140, 'FIXED', 'FIXED']],
  ['se', 60, 40, true, [200, 150, 280, 140, 'FIXED', 'FIXED']],
  ['e', -60, 0, true, [200, 165, 140, 70, 'FIXED', 'FIXED']]
]

function hugFrame(locked: boolean) {
  const editor = createEditor()
  editor.state.snappingPreferences = { geometry: false, objects: false, pixelGrid: false }
  const page = editor.state.currentPageId
  const a = editor.graph.createNode('FRAME', page, { x: 200, y: 150, width: 100, height: 100 })
  const b = editor.graph.createNode('FRAME', page, { x: 300, y: 150, width: 100, height: 100 })
  editor.select([a.id, b.id])
  const id = editor.wrapInAutoLayout()
  if (!id) throw new Error('No auto layout frame')
  if (locked) editor.updateNodeWithUndo(id, { targetAspectRatio: { x: 200, y: 100 } })
  editor.select([id])
  return { editor, id }
}

function startDrag(editor: ReturnType<typeof createEditor>, id: string, handle: string) {
  const node = editor.graph.getNode(id)
  if (!node) throw new Error('Missing frame')
  const x = node.x + (handle === 's' ? node.width / 2 : node.width)
  const y = node.y + (handle === 'e' ? node.height / 2 : node.height)
  const drag = tryStartResize(x, y, editor)
  if (!drag) throw new Error(`No ${handle} handle`)
  return { drag, x, y }
}

function read(editor: ReturnType<typeof createEditor>, id: string): (number | string)[] {
  const node = editor.graph.getNode(id)
  if (!node) throw new Error('Missing frame')
  const row = node.layoutMode === 'HORIZONTAL'
  return [
    node.x,
    node.y,
    node.width,
    node.height,
    row ? node.primaryAxisSizing : node.counterAxisSizing,
    row ? node.counterAxisSizing : node.primaryAxisSizing
  ]
}

describe('dragging a handle of a Hug frame', () => {
  for (const [handle, dx, dy, locked, expected] of CASES) {
    test(`${locked ? 'locked' : 'free'} ${handle} ${dx},${dy} fixes the axes it resizes`, () => {
      const { editor, id } = hugFrame(locked)
      const { drag, x, y } = startDrag(editor, id, handle)
      applyResize(drag, x + dx, y + dy, false, editor)
      commitResizePreview(drag, editor)
      expect(read(editor, id)).toEqual(expected)

      editor.undoAction()
      expect(read(editor, id)).toEqual([200, 150, 200, 100, 'HUG', 'HUG'])
    })
  }

  test('a cancelled drag leaves the frame hugging', () => {
    const { editor, id } = hugFrame(true)
    const { drag, x, y } = startDrag(editor, id, 'se')
    applyResize(drag, x + 60, y + 40, false, editor)
    cancelResizePreview(drag, editor)
    expect(read(editor, id)).toEqual([200, 150, 200, 100, 'HUG', 'HUG'])
  })
})
