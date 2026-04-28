import { extendSelectionForDeletion, handleNavigationKey } from './navigation'

import type { SceneNode } from '@open-pencil/core/scene-graph'
import type { Editor } from '@open-pencil/core/editor'

type TextKeyboardOptions = {
  store: Editor
  canvasRef: { value: HTMLCanvasElement | null }
  getEditingNode: () => SceneNode | null
  isComposing: () => boolean
  insertText: (text: string, node: SceneNode) => void
  deleteText: (node: SceneNode, forward: boolean) => void
  resetBlink: () => void
  handleCopy: () => void
  handleCut: (node: SceneNode) => void
  handlePaste: (node: SceneNode) => Promise<void>
  toggleBold: (node: SceneNode) => void
  toggleItalic: (node: SceneNode) => void
  toggleUnderline: (node: SceneNode) => void
}

export function createTextKeyDownHandler(options: TextKeyboardOptions) {
  type MetaAction = (node: SceneNode) => void
  const metaKeyActions: Partial<Record<string, MetaAction>> = {
    KeyA: () => options.store.textEditor?.selectAll(),
    KeyC: () => options.handleCopy(),
    KeyX: (node) => options.handleCut(node),
    KeyV: (node) => void options.handlePaste(node),
    KeyB: (node) => options.toggleBold(node),
    KeyI: (node) => options.toggleItalic(node),
    KeyU: (node) => options.toggleUnderline(node)
  }

  function handleMetaKey(e: KeyboardEvent, node: SceneNode) {
    const action = metaKeyActions[e.code]
    if (!action) return false
    action(node)
    e.preventDefault()
    return true
  }

  return function onKeyDown(e: KeyboardEvent) {
    if (options.isComposing()) return
    const editor = options.store.textEditor
    const node = options.getEditingNode()
    if (!editor || !node) return

    const isMeta = e.metaKey || e.ctrlKey
    let textChanged = false

    if (e.code === 'Escape') {
      options.store.commitTextEdit()
      options.canvasRef.value?.focus()
      e.preventDefault()
      return
    }

    if (e.code === 'Enter') {
      options.insertText('\n', node)
      textChanged = true
    } else if (e.code === 'Backspace' || e.code === 'Delete') {
      extendSelectionForDeletion(e, editor)
      options.deleteText(node, e.code === 'Delete')
      textChanged = true
    } else if (!handleNavigationKey(e, editor)) {
      if (!isMeta || !handleMetaKey(e, node)) return
      return
    }

    if (!textChanged) options.store.requestRender()
    options.resetBlink()
    e.preventDefault()
  }
}
