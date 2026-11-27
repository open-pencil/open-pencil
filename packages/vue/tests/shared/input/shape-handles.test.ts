import { afterEach, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'

import { resolveShapeHandleHover } from '#vue/shared/input/shape-handles'

let editor: Editor

afterEach(() => editor.dispose())

test('a pointer left on a selected shape’s corner shows its handles at any zoom', () => {
  editor = createEditor()
  const page = editor.state.currentPageId
  const rect = editor.graph.createNode('RECTANGLE', page, { width: 449, height: 336 }).id
  editor.select([rect])
  // At 44.5% the far corner the drawing ended on is a fraction of a canvas unit past the shape.
  Object.assign(editor.state, { zoom: 0.445, panX: 0, panY: 0 })
  const corner = { x: 449.4 * 0.445, y: 336.4 * 0.445 }
  expect(resolveShapeHandleHover(editor, corner.x, corner.y, false)?.nodeId).toBe(rect)
  expect(resolveShapeHandleHover(editor, corner.x + 20, corner.y + 20, false)).toBeNull()
})
