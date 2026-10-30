import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'

import { createCanvasLabelEdit } from '#vue/canvas/labels/edit'

describe('canvas label renaming', () => {
  // Figma shows only the field while a name is renamed; the canvas title would show through.
  test('the canvas leaves a renamed title to the field until the rename ends', () => {
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
