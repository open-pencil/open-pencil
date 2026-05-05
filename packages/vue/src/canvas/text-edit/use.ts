import { useEventListener } from '@vueuse/core'
import { shallowRef, type Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'

import { createTextClipboardActions } from './clipboard'
import { createCaretBlink, createTextCompositionHandlers, createTextEditActions } from './editing'
import { createTextFormattingActions } from './formatting'
import { createTextKeyDownHandler } from './keyboard'
import { focusTextAreaOnCanvasPointerDown, useTextEditingSession } from './textarea'

/**
 * Bridges DOM text input and the editor's canvas text-editing model.
 *
 * This composable manages textarea-backed input, IME composition, caret
 * blinking, keyboard editing behavior, text formatting shortcuts, and syncing
 * text/style-run updates back into the scene graph.
 */
export function useTextEdit(canvasRef: Ref<HTMLCanvasElement | null>, store: Editor) {
  const textareaRef = shallowRef<HTMLTextAreaElement | null>(null)
  const { resetBlink, stopBlink } = createCaretBlink(store)
  const { getEditingNode, insertText, deleteText } = createTextEditActions(store)
  const { toggleBold, toggleItalic, toggleUnderline } = createTextFormattingActions(store)

  const { handleCopy, handleCut, handlePaste } = createTextClipboardActions({
    store,
    insertText,
    deleteText,
    resetBlink
  })
  const { isComposing, onCompositionStart, onCompositionEnd, onInput, resetComposition } =
    createTextCompositionHandlers({ textareaRef, getEditingNode, insertText, resetBlink })

  const onKeyDown = createTextKeyDownHandler({
    store,
    canvasRef,
    getEditingNode,
    isComposing,
    insertText,
    deleteText,
    resetBlink,
    handleCopy,
    handleCut,
    handlePaste,
    toggleBold,
    toggleItalic,
    toggleUnderline
  })

  useEventListener(textareaRef, 'input', onInput)
  useEventListener(textareaRef, 'compositionstart', onCompositionStart)
  useEventListener(textareaRef, 'compositionend', onCompositionEnd)
  useEventListener(textareaRef, 'keydown', onKeyDown)
  useEventListener(canvasRef, 'mousedown', () =>
    focusTextAreaOnCanvasPointerDown(textareaRef, store)
  )

  useTextEditingSession({ store, textareaRef, resetBlink, stopBlink, resetComposition })
}
