import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

describe('preview updates', () => {
  test('do not emit committed node update events', () => {
    const editor = createEditor()
    const page = editor.graph.getPages()[0]
    const node = editor.graph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 10,
      height: 10
    })

    const initialSceneVersion = editor.state.sceneVersion
    const initialRenderVersion = editor.state.renderVersion
    let committedUpdates = 0
    editor.onEditorEvent('node:updated', () => {
      committedUpdates++
    })

    editor.graph.updateNodePreview(node.id, { width: 20 })

    expect(committedUpdates).toBe(0)
    expect(editor.state.sceneVersion).toBe(initialSceneVersion)
    expect(editor.state.renderVersion).toBe(initialRenderVersion)
  })
})
