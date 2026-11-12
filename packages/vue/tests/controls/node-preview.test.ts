import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'

import { useNodePreview } from '#vue/controls/node-preview/use'

for (const operation of ['update', 'commit'] as const) {
  test(`a failed preview ${operation} releases targets for the next interaction`, () => {
    const editor = createEditor()
    const control = useNodePreview(editor)
    try {
      const node = editor.graph.createNode('COMPONENT', editor.state.currentPageId, { x: 10 })
      const next = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, { x: 20 })
      if (operation === 'commit') control.update([node.id], { x: 50 }, 'Move')
      editor.graph.updateNode(node.id, {
        librarySource: {
          identity: { libraryId: 'preview-test', assetKey: 'component', revisionId: 'r1' },
          sourceNodeId: 'source',
          readOnly: true
        }
      })
      expect(() => {
        if (operation === 'commit') control.commit()
        else control.update([node.id], { x: 50 }, 'Move')
      }).toThrow('Edit the source library')
      expect(editor.isInteractiveEditing()).toBe(false)
      control.update([next.id], { x: 90 }, 'Move')
      expect(editor.graph.getNode(next.id)?.x).toBe(90)
      control.commit()
      expect(next.x).toBe(90)
      editor.undoAction()
      expect(next.x).toBe(20)
    } finally {
      control.cancel()
      editor.dispose()
    }
  })
}
