import type { Editor } from '@lawha/core'
import type { SceneNode } from '@lawha/scene-graph'

type TextClipboardOptions = {
  store: Editor
  insertText: (text: string, node: SceneNode) => void
  deleteText: (node: SceneNode, forward: boolean) => void
  resetBlink: () => void
}

export function createTextClipboardActions({
  store,
  insertText,
  deleteText,
  resetBlink
}: TextClipboardOptions) {
  function handleCopy() {
    const editor = store.textEditor
    if (!editor) return
    const text = editor.getSelectedText()
    if (text) void navigator.clipboard.writeText(text)
  }

  function handleCut(node: SceneNode | null) {
    const editor = store.textEditor
    if (!editor || !node) return
    const text = editor.getSelectedText()
    if (text) {
      void navigator.clipboard.writeText(text)
      deleteText(node, false)
      resetBlink()
    }
  }

  async function handlePaste(node: SceneNode | null) {
    const editor = store.textEditor
    if (!editor || !node) return
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        insertText(text, node)
        resetBlink()
      }
    } catch (error) {
      console.warn('Clipboard access denied:', error)
    }
  }

  return { handleCopy, handleCut, handlePaste }
}
