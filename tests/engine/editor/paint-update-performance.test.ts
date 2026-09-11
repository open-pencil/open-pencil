import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { changesAffectLayout } from '@open-pencil/scene-graph'

const solid = (r: number) => [
  { type: 'SOLID' as const, color: { r, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
]

test('paint-only updates remain non-layout mutations at document scale', () => {
  const editor = createEditor()
  const page = editor.state.currentPageId
  const target = editor.graph.createNode('RECTANGLE', page, { fills: solid(0) })
  for (let index = 0; index < 5_000; index++)
    editor.graph.createNode('RECTANGLE', page, { x: index, fills: solid(0) })
  expect(changesAffectLayout({ fills: solid(0.5) })).toBe(false)
  const started = performance.now()
  for (let index = 0; index < 120; index++)
    editor.updateNodeWithUndo(target.id, { fills: solid(index / 120) }, 'Change fills')
  const elapsed = performance.now() - started
  expect(elapsed).toBeLessThan(100)
  expect(editor.graph.getNode(target.id)?.fills[0]?.color.r).toBeCloseTo(119 / 120)
})

test('geometry edits still run layout and remain undoable', () => {
  const editor = createEditor()
  const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, { width: 20 })
  expect(changesAffectLayout({ width: 40 })).toBe(true)
  editor.updateNodeWithUndo(node.id, { width: 40 })
  expect(editor.graph.getNode(node.id)?.width).toBe(40)
  editor.undo.undo()
  expect(editor.graph.getNode(node.id)?.width).toBe(20)
})
