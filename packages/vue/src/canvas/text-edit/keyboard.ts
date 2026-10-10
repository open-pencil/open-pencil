import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode, TextListType } from '@open-pencil/scene-graph'

import { extendSelectionForDeletion, handleNavigationKey } from './navigation'

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
  toggleListType: (node: SceneNode, listType: Exclude<TextListType, 'NONE'>) => void
  changeIndentation: (node: SceneNode, delta: 1 | -1) => boolean
}

export function createTextKeyDownHandler(options: TextKeyboardOptions) {
  type MetaAction = (node: SceneNode) => void
  const metaKeyActions: Partial<Record<string, MetaAction>> = {
    KeyA: () => {
      options.store.textEditor?.selectAll()
      options.store.textSelectionChanged()
    },
    KeyC: () => options.handleCopy(),
    KeyX: (node) => options.handleCut(node),
    KeyV: (node) => void options.handlePaste(node),
    KeyB: (node) => options.toggleBold(node),
    KeyI: (node) => options.toggleItalic(node),
    KeyU: (node) => options.toggleUnderline(node)
  }

  // Figma's list shortcuts: ⌘⇧8 for bullets, ⌘⇧7 for numbers.
  const metaShiftKeyActions: Partial<Record<string, MetaAction>> = {
    Digit8: (node) => options.toggleListType(node, 'UNORDERED'),
    Digit7: (node) => options.toggleListType(node, 'ORDERED')
  }

  function handleMetaKey(e: KeyboardEvent, node: SceneNode) {
    const action = (e.shiftKey ? metaShiftKeyActions : metaKeyActions)[e.code]
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
    } else if (e.code === 'Tab' && !isMeta) {
      // Tab nests a list item and Shift+Tab unnests it; outside a list Tab keeps its default.
      if (!options.changeIndentation(node, e.shiftKey ? -1 : 1)) return
    } else if (e.code === 'Backspace' || e.code === 'Delete') {
      extendSelectionForDeletion(e, editor)
      options.deleteText(node, e.code === 'Delete')
      textChanged = true
    } else if (!handleNavigationKey(e, editor)) {
      if (!isMeta || !handleMetaKey(e, node)) return
      return
    }

    // Moving the caret changes no text: the overlay repaints and the panel follows it.
    if (!textChanged) options.store.textSelectionChanged()
    options.resetBlink()
    e.preventDefault()
  }
}
