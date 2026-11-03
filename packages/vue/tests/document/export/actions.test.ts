import { describe, expect, test } from 'bun:test'

import { computed } from 'vue'

import { createEditor } from '@open-pencil/core'

import { createExportSettingActions } from '#vue/document/export/helpers'

describe('createExportSettingActions', () => {
  test('a chosen scale replaces a fixed width or height', () => {
    const editor = createEditor()
    const rect = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      width: 40,
      height: 20,
      exportSettings: [{ scale: 1, format: 'png', size: { type: 'WIDTH', value: 300 } }]
    })
    const { updateScale } = createExportSettingActions(
      editor,
      computed(() => [rect.id])
    )

    updateScale(0, 2)

    expect(editor.graph.getNode(rect.id)?.exportSettings).toEqual([{ scale: 2, format: 'png' }])
  })
})
