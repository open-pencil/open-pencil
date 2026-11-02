import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'

import { createCanvasLabelEdit } from '#vue/canvas/labels/edit'

describe('canvas label renaming', () => {
  // The canvas skips the title of `renamingLabelId` (tests/e2e/canvas/labels/name-editing.spec.ts).
  test('marks the layer being renamed until the rename ends', () => {
    const editor = createEditor()
    const id = editor.createShape('SECTION', 0, 0, 224, 192)
    const node = editor.graph.getNode(id)
    if (!node) throw new Error('Expected the section')
    const labels = createCanvasLabelEdit(editor)

    labels.start('section-title', node)
    expect(editor.state.renamingLabelId).toBe(id)
    labels.update('Se')
    labels.commit()
    expect([editor.state.renamingLabelId, editor.graph.getNode(id)?.name]).toEqual([null, 'Se'])

    labels.start('section-title', node)
    labels.cancel()
    expect(editor.state.renamingLabelId).toBeNull()
  })
})
