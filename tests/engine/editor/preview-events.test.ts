import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

describe('preview updates', () => {
  test('rotation notifications observe published state and clearing is reentrant', () => {
    const editor = createEditor()
    try {
      const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
        rotation: 10
      })
      const sceneVersion = editor.state.sceneVersion
      const angles: Array<number | null> = []
      editor.onEditorEvent('rotation:preview-changed', (preview) => {
        expect(editor.state.rotationPreview).toBe(preview)
        angles.push(preview?.angle ?? null)
        if (!preview) editor.setRotationPreview(null)
      })
      editor.setRotationPreview({ nodeId: node.id, angle: 40 })
      editor.setRotationPreview(null)
      editor.setRotationPreview(null)
      expect(angles).toEqual([40, null])
      expect(node.rotation).toBe(10)
      expect(editor.state.sceneVersion).toBe(sceneVersion)
    } finally {
      editor.dispose()
    }
  })

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
    const previews: Array<{ id: string; width?: number }> = []
    editor.onEditorEvent('node:previewUpdated', (id, changes) => {
      previews.push({ id, width: changes.width })
    })
    let committedUpdates = 0
    editor.onEditorEvent('node:updated', () => {
      committedUpdates++
    })

    editor.graph.updateNodePreview(node.id, { width: 20 })

    expect(previews).toEqual([{ id: node.id, width: 20 }])
    expect(committedUpdates).toBe(0)
    expect(editor.state.sceneVersion).toBe(initialSceneVersion)
    expect(editor.state.renderVersion).toBe(initialRenderVersion)

    editor.graph.updateNodePreview(node.id, { width: 20 })
    editor.pan(5, 10)
    expect(previews).toHaveLength(1)
    expect(editor.state.sceneVersion).toBe(initialSceneVersion)
  })
})
