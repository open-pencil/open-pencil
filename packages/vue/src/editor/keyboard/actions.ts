import { opacityFromBuffer, type Editor } from '@open-pencil/core'
import { generatedFrameText } from '@open-pencil/scene-graph/generated'
import { randomHex } from '@open-pencil/scene-graph/random'

import type { useEditorCommands } from '#vue/editor/commands'

type EditorCommands = ReturnType<typeof useEditorCommands>

export interface EditorKeyActionsOptions {
  editor: Editor
  runCommand: EditorCommands['runCommand']
  setOpacityTarget: EditorCommands['setOpacityTarget']
  /**
   * The host's own Escape, run once nothing in progress took it (a path, a pen or pencil stroke,
   * a preview, a rotation, the eyedropper) and before the selection clears: return true when it
   * handled the key, as closing a comment card does.
   */
  onEscape?: () => boolean
}

/** What the editor's keys do beyond running one command: Delete, Enter, Escape, Shift+A, digits. */
export function createEditorKeyActions({
  editor,
  runCommand,
  setOpacityTarget,
  onEscape
}: EditorKeyActionsOptions) {
  function hasNodeEditSelection() {
    return (
      editor.state.nodeEditState &&
      (editor.state.nodeEditState.selectedVertexIndices.size > 0 ||
        editor.state.nodeEditState.selectedSegmentIndices.size > 0 ||
        editor.state.nodeEditState.selectedHandles.size > 0)
    )
  }

  function smartDelete(altKey: boolean) {
    if (hasNodeEditSelection()) {
      if (altKey) editor.nodeEditBreakAtVertex()
      else editor.nodeEditDeleteSelected()
      return
    }
    runCommand('selection.delete')
  }

  function confirmOrEditSelection() {
    if (editor.state.nodeEditState) {
      editor.exitNodeEditMode(true)
      return
    }
    if (editor.state.penState) {
      editor.penCommit(false)
      return
    }
    const node = editor.getSelectedNode()
    // Figma opens a selected vector's path, as a double-click does.
    if (node?.type === 'VECTOR') {
      editor.enterNodeEditMode(node.id)
      return
    }
    // A sticky note opens its body and a connector its label, all of it selected, keeping the
    // note or connector selected.
    const text = (node && generatedFrameText(editor.graph, node)) ?? node
    if (text?.type === 'TEXT') {
      requestAnimationFrame(() => {
        editor.startTextEditing(text.id)
        editor.textEditor?.selectAll()
        editor.requestRender()
      })
      return
    }
    runCommand('selection.selectChildren')
  }

  function escapeOrDeselect() {
    if (editor.leaveCanvasView()) return
    if (editor.state.rotationPreview) {
      editor.setRotationPreview(null)
      return
    }
    // Esc leaves the eyedropper without touching the selection or a waiting color picker.
    if (editor.state.activeTool === 'EYEDROPPER') {
      editor.setTool('SELECT')
      return
    }
    if (editor.state.nodeEditState) {
      editor.exitNodeEditMode(true)
      return
    }
    if (editor.state.pencilState) {
      editor.pencilCancel()
      return
    }
    // Figma keeps the path drawn so far; a lone point has nothing to keep.
    if (editor.state.penState) {
      if (editor.state.penState.vertices.length >= 2) editor.penCommit(false)
      else editor.penCancel()
      return
    }
    if (onEscape?.()) return
    // Figma's Escape clears the selection at any depth; Shift+Enter is the way up a level.
    editor.exitContainers()
    editor.clearSelection()
    editor.setTool('SELECT')
  }

  function toggleAutoLayout() {
    const node = editor.getSelectedNode()
    if (node?.type === 'FRAME' && editor.getSelectedNodes().length === 1) {
      editor.setLayoutMode(node.id, node.layoutMode === 'NONE' ? 'VERTICAL' : 'NONE')
    } else if (editor.getSelectedNodes().length > 0) {
      runCommand('selection.wrapInAutoLayout')
    }
  }

  let opacityBuffer = ''
  let opacitySelectionKey = ''
  let opacityCoalesceKey = ''
  let opacityResetTimer: ReturnType<typeof setTimeout> | undefined

  function resetOpacityBuffer() {
    opacityBuffer = ''
    opacitySelectionKey = ''
    opacityCoalesceKey = ''
    clearTimeout(opacityResetTimer)
  }

  function opacityDigit(digit: string) {
    if (editor.state.selectedIds.size === 0) return
    const selectionKey = [...editor.state.selectedIds].sort().join('\0')
    if (selectionKey !== opacitySelectionKey) resetOpacityBuffer()
    if (!opacityBuffer) {
      opacitySelectionKey = selectionKey
      opacityCoalesceKey = randomHex()
    }
    opacityBuffer += digit
    if (opacityBuffer.length > 3) opacityBuffer = opacityBuffer.slice(-3)
    setOpacityTarget(opacityFromBuffer(opacityBuffer), opacityCoalesceKey)
    runCommand('selection.setOpacity')
    clearTimeout(opacityResetTimer)
    opacityResetTimer = setTimeout(resetOpacityBuffer, 800)
  }

  return {
    smartDelete,
    confirmOrEditSelection,
    escapeOrDeselect,
    toggleAutoLayout,
    opacityDigit
  }
}
