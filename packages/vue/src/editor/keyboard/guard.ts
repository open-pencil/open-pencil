import type { ComputedRef } from 'vue'

import { resolveEditorProfile, type Editor } from '@open-pencil/core'

import { isCanvasTextInput } from '#vue/canvas/text-edit'
import type { OpenOverlays } from '#vue/lifecycle/overlays'

import { isButtonActivation, isEditing } from './focus'
import { overlayHoldsKeys } from './overlays'
import type { EditorShortcut } from './shortcuts'

export interface ShortcutGuardOptions {
  editor: Editor
  overlays: OpenOverlays | undefined
  /** Whether a text field, a text area, or editable content on the page has focus. */
  inputFocused: ComputedRef<boolean>
  /** The host's own reasons to hold the editor's keys back. */
  ignore?: (event: KeyboardEvent) => boolean
}

/**
 * Whether a shortcut may run for a key press. A global one always may. The others wait while a
 * button, a text field, an open dialog or menu, or text being edited has the key, and a preview
 * keeps only those that leave it; undo and redo still run with a picker open, as in Figma.
 */
export function createShortcutGuard({
  editor,
  overlays,
  inputFocused,
  ignore
}: ShortcutGuardOptions) {
  /**
   * While text is edited its input handles the keys, undo and redo among them. Focus can leave it
   * for a panel field while the edit stays open, as after a typed font size; undo and redo then
   * run on the editor's history, which records the text edit's steps, rather than go nowhere.
   */
  function textEditTakes(history: boolean) {
    if (!editor.state.editingTextId) return false
    return !history || isCanvasTextInput(document.activeElement)
  }

  function heldBack(event: KeyboardEvent, history: boolean) {
    return (
      isButtonActivation(event) ||
      overlayHoldsKeys(event, overlays, history) ||
      isEditing(event) ||
      inputFocused.value ||
      textEditTakes(history) ||
      !!ignore?.(event)
    )
  }

  return (event: KeyboardEvent, shortcut: EditorShortcut): boolean => {
    if (shortcut.global) return true
    if (heldBack(event, !!shortcut.history)) return false
    return !!shortcut.view || resolveEditorProfile(editor.state).shortcuts !== 'view'
  }
}
