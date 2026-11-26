import { isCanvasTextInput } from '@open-pencil/vue/canvas/text-edit'
import type { EditorCommandId } from '@open-pencil/vue/editor/commands'
import { isInputElement } from '@open-pencil/vue/editor/keyboard'

import type { EditorStore } from '@/app/editor/active-store'

/**
 * Commands a focused text field carries out itself. As in VS Code's
 * `EditorOrNativeTextInputCommand`, `execCommand` is the one API that reaches a field's own
 * selection and undo history.
 */
const TEXT_FIELD_EDITS: Partial<Record<EditorCommandId, 'selectAll' | 'undo' | 'redo'>> = {
  'selection.selectAll': 'selectAll',
  'edit.undo': 'undo',
  'edit.redo': 'redo'
}

/** The `beforeinput` types a field's own history answers, as CodeMirror's `history()` does. */
const HISTORY_INPUT_TYPES = { undo: 'historyUndo', redo: 'historyRedo' } as const

/**
 * Carries out `edit` in the focused field. Undo and redo go first as the `beforeinput` event the
 * browser sends for them, which an editor with its own history, such as CodeMirror, takes; the
 * browser's own undo stack only knows what was typed, not the edits such an editor's commands
 * make. Fields that leave the event alone get `execCommand`.
 */
function runFieldEdit(edit: 'selectAll' | 'undo' | 'redo'): void {
  const field = document.activeElement
  if (field && edit !== 'selectAll') {
    const event = new InputEvent('beforeinput', {
      inputType: HISTORY_INPUT_TYPES[edit],
      bubbles: true,
      cancelable: true
    })
    if (!field.dispatchEvent(event)) return
  }
  document.execCommand(edit)
}

/** A text field in the page has focus; the canvas text editor types through its own textarea. */
export function textFieldFocused(): boolean {
  const active = document.activeElement
  return isInputElement(active) && !isCanvasTextInput(active)
}

/**
 * Runs a command against what has keyboard focus when it runs. A focused text field takes the
 * edits it has its own version of, and commands on the document or selection wait for the
 * canvas, as keyboard shortcuts do; view commands still run.
 *
 * Entry points that keep the person's focus, the native menu, run commands through this. The
 * command palette and the in-app menu take focus themselves and act on the document.
 */
export function runFocusedCommand(
  store: EditorStore,
  runCommand: (id: EditorCommandId) => void,
  id: EditorCommandId
): void {
  if (id === 'selection.selectAll' && isCanvasTextInput(document.activeElement)) {
    store.textEditor?.selectAll()
    store.requestRender()
    return
  }
  if (textFieldFocused()) {
    const edit = TEXT_FIELD_EDITS[id]
    if (edit) runFieldEdit(edit)
    else if (id.startsWith('view.')) runCommand(id)
    return
  }
  runCommand(id)
}

/** An action on the canvas selection that waits, like the commands above, while a field has focus. */
export function onCanvasSelection(action: () => void): () => void {
  return () => {
    if (!textFieldFocused()) action()
  }
}
