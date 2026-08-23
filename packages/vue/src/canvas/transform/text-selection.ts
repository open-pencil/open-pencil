import type { Editor } from '@open-pencil/core/editor'

export function handleTextSelectMove(editor: Editor, cx: number, cy: number) {
  const textEditor = editor.textEditor
  const editNode = editor.state.editingTextId
    ? editor.graph.getNode(editor.state.editingTextId)
    : null
  if (textEditor && editNode) {
    const abs = editor.graph.getAbsolutePosition(editNode.id)
    textEditor.setCursorAt(cx - abs.x, cy - abs.y, true)
    editor.requestRender()
  }
}
