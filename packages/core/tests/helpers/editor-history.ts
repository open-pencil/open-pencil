import { createEditor } from '@open-pencil/core/editor'
import type { Editor } from '@open-pencil/core/editor'

export function setupEditorPage() {
  const editor = createEditor()
  const pageId = editor.graph.getPages()[0].id
  return { editor, pageId }
}

export function createHistoryFrame(
  editor: Editor,
  parentId: string,
  overrides: Partial<{ name: string; x: number; y: number; width: number; height: number }> = {}
) {
  return editor.graph.createNode('FRAME', parentId, {
    name: 'Card',
    x: 0,
    y: 0,
    width: 200,
    height: 150,
    ...overrides
  })
}
