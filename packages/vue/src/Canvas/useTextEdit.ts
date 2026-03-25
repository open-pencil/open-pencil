import { useEventListener } from '@vueuse/core'
import { shallowRef, watch, type Ref } from 'vue'

import {
  adjustRunsForDelete,
  adjustRunsForInsert,
  toggleBoldInRange,
  toggleDecorationInRange,
  toggleItalicInRange
} from '@open-pencil/core'

import type { SceneNode } from '@open-pencil/core'
import type { Editor } from '@open-pencil/core/editor'

const CARET_BLINK_MS = 530

/**
 * Bridges DOM text input and the editor's canvas text-editing model.
 *
 * This composable manages textarea-backed input, IME composition, caret
 * blinking, keyboard editing behavior, text formatting shortcuts, and syncing
 * text/style-run updates back into the scene graph.
 */
export function useTextEdit(canvasRef: Ref<HTMLCanvasElement | null>, store: Editor) {
  const textareaRef = shallowRef<HTMLTextAreaElement | null>(null)
  let isComposing = false
  let blinkTimer = 0

  function getEditingNode() {
    const id = store.state.editingTextId
    if (!id) return null
    return store.graph.getNode(id) ?? null
  }

  function resetBlink() {
    if (store.textEditor) store.textEditor.caretVisible = true
    clearInterval(blinkTimer)
    blinkTimer = window.setInterval(() => {
      if (!store.textEditor) return
      store.textEditor.caretVisible = !store.textEditor.caretVisible
      store.requestRepaint()
    }, CARET_BLINK_MS)
    store.requestRepaint()
  }

  function syncText(nodeId: string, text: string, runs?: SceneNode['styleRuns']) {
    const changes: Partial<SceneNode> = { text }
    if (runs !== undefined) changes.styleRuns = runs
    store.graph.updateNode(nodeId, changes)
    store.requestRender()
  }

  function insertText(text: string, node: SceneNode) {
    const editor = store.textEditor
    if (!editor) return
    const range = editor.getSelectionRange()
    let runs = node.styleRuns
    if (range) {
      runs = adjustRunsForDelete(runs, range[0], range[1] - range[0])
      runs = adjustRunsForInsert(runs, range[0], text.length)
    } else {
      runs = adjustRunsForInsert(runs, editor.state?.cursor ?? 0, text.length)
    }
    editor.insert(text, node)
    syncText(node.id, editor.state?.text ?? '', runs)
  }

  function deleteText(node: SceneNode, forward: boolean) {
    const editor = store.textEditor
    if (!editor) return
    const range = editor.getSelectionRange()
    let runs = node.styleRuns
    if (range) {
      runs = adjustRunsForDelete(runs, range[0], range[1] - range[0])
    } else if (forward && editor.state && editor.state.cursor < node.text.length) {
      runs = adjustRunsForDelete(runs, editor.state.cursor, 1)
    } else if (!forward && editor.state && editor.state.cursor > 0) {
      runs = adjustRunsForDelete(runs, editor.state.cursor - 1, 1)
    }
    if (forward) {
      editor.delete(node)
    } else {
      editor.backspace(node)
    }
    syncText(node.id, editor.state?.text ?? '', runs)
  }

  function onCompositionStart() {
    isComposing = true
  }

  function onCompositionEnd(e: CompositionEvent) {
    isComposing = false
    if (!e.data) return
    const node = getEditingNode()
    if (!node) return
    insertText(e.data, node)
    if (textareaRef.value) textareaRef.value.value = ''
    resetBlink()
  }

  function onInput() {
    const el = textareaRef.value
    if (isComposing || !el) return
    const text = el.value
    if (!text) return
    el.value = ''

    const node = getEditingNode()
    if (!node) return
    insertText(text, node)
    resetBlink()
  }

  function handleHorizontalArrow(e: KeyboardEvent, editor: NonNullable<typeof store.textEditor>) {
    const select = e.shiftKey
    const isMeta = e.metaKey || e.ctrlKey
    if (e.code === 'ArrowLeft') {
      if (isMeta) editor.moveToLineStart(select)
      else if (e.altKey) editor.moveWordLeft(select)
      else editor.moveLeft(select)
    } else if (e.code === 'ArrowRight') {
      if (isMeta) editor.moveToLineEnd(select)
      else if (e.altKey) editor.moveWordRight(select)
      else editor.moveRight(select)
    }
  }

  function handleDeletion(
    e: KeyboardEvent,
    editor: NonNullable<typeof store.textEditor>,
    node: SceneNode
  ) {
    const isMeta = e.metaKey || e.ctrlKey
    const forward = e.code === 'Delete'
    if (forward) {
      if (isMeta) editor.moveToLineEnd(true)
      else if (e.altKey) editor.moveWordRight(true)
    } else {
      if (isMeta) editor.moveToLineStart(true)
      else if (e.altKey) editor.moveWordLeft(true)
    }
    deleteText(node, forward)
  }

  type MetaAction = (node: SceneNode) => void
  const metaKeyActions: Partial<Record<string, MetaAction>> = {
    KeyA: () => store.textEditor?.selectAll(),
    KeyC: () => handleCopy(),
    KeyX: (node) => handleCut(node),
    KeyV: (node) => void handlePaste(node),
    KeyB: (node) => toggleBold(node),
    KeyI: (node) => toggleItalic(node),
    KeyU: (node) => toggleUnderline(node)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (isComposing) return
    const editor = store.textEditor
    const node = getEditingNode()
    if (!editor || !node) return

    const isMeta = e.metaKey || e.ctrlKey
    let textChanged = false

    switch (e.code) {
      case 'Escape':
        store.commitTextEdit()
        canvasRef.value?.focus()
        e.preventDefault()
        return
      case 'Enter':
        insertText('\n', node)
        textChanged = true
        break
      case 'Backspace':
      case 'Delete':
        handleDeletion(e, editor, node)
        textChanged = true
        break
      case 'ArrowLeft':
      case 'ArrowRight':
        handleHorizontalArrow(e, editor)
        break
      case 'ArrowUp':
        editor.moveUp(e.shiftKey)
        break
      case 'ArrowDown':
        editor.moveDown(e.shiftKey)
        break
      case 'Home':
        editor.moveToLineStart(e.shiftKey)
        break
      case 'End':
        editor.moveToLineEnd(e.shiftKey)
        break
      default: {
        if (!isMeta) return
        const action = metaKeyActions[e.code]
        if (!action) return
        action(node)
        e.preventDefault()
        return
      }
    }

    if (!textChanged) {
      store.requestRender()
    }
    resetBlink()
    e.preventDefault()
  }

  function applyFormatting(nodeId: string, changes: Partial<SceneNode>, label: string) {
    store.updateNodeWithUndo(nodeId, changes, label)
    const updated = store.graph.getNode(nodeId)
    if (updated) store.textEditor?.rebuildParagraph(updated)
    store.requestRender()
  }

  function toggleBold(node: SceneNode) {
    const editor = store.textEditor
    const range = editor?.getSelectionRange()
    if (range) {
      const { runs } = toggleBoldInRange(
        node.styleRuns,
        range[0],
        range[1],
        node.fontWeight,
        node.text.length
      )
      applyFormatting(node.id, { styleRuns: runs }, 'Toggle bold')
    } else {
      applyFormatting(node.id, { fontWeight: node.fontWeight >= 700 ? 400 : 700 }, 'Toggle bold')
    }
  }

  function toggleItalic(node: SceneNode) {
    const editor = store.textEditor
    const range = editor?.getSelectionRange()
    if (range) {
      const { runs } = toggleItalicInRange(
        node.styleRuns,
        range[0],
        range[1],
        node.italic,
        node.text.length
      )
      applyFormatting(node.id, { styleRuns: runs }, 'Toggle italic')
    } else {
      applyFormatting(node.id, { italic: !node.italic }, 'Toggle italic')
    }
  }

  function toggleUnderline(node: SceneNode) {
    const editor = store.textEditor
    const range = editor?.getSelectionRange()
    if (range) {
      const { runs } = toggleDecorationInRange(
        node.styleRuns,
        range[0],
        range[1],
        'UNDERLINE',
        node.textDecoration,
        node.text.length
      )
      applyFormatting(node.id, { styleRuns: runs }, 'Toggle underline')
    } else {
      applyFormatting(
        node.id,
        { textDecoration: node.textDecoration === 'UNDERLINE' ? 'NONE' : 'UNDERLINE' },
        'Toggle underline'
      )
    }
  }

  function handleCopy() {
    const editor = store.textEditor
    if (!editor) return
    const text = editor.getSelectedText()
    if (text) void navigator.clipboard.writeText(text)
  }

  function handleCut(node: ReturnType<typeof getEditingNode>) {
    const editor = store.textEditor
    if (!editor || !node) return
    const text = editor.getSelectedText()
    if (text) {
      void navigator.clipboard.writeText(text)
      deleteText(node, false)
      resetBlink()
    }
  }

  async function handlePaste(node: ReturnType<typeof getEditingNode>) {
    const editor = store.textEditor
    if (!editor || !node) return
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        insertText(text, node)
        resetBlink()
      }
    } catch (e) {
      console.warn('Clipboard access denied:', e)
    }
  }

  useEventListener(textareaRef, 'input', onInput)
  useEventListener(textareaRef, 'compositionstart', onCompositionStart)
  useEventListener(textareaRef, 'compositionend', onCompositionEnd)
  useEventListener(textareaRef, 'keydown', onKeyDown)

  useEventListener(canvasRef, 'mousedown', () => {
    if (store.state.editingTextId && textareaRef.value) {
      requestAnimationFrame(() => textareaRef.value?.focus())
    }
  })

  watch(
    () => store.state.editingTextId,
    (id, _, onCleanup) => {
      if (id) {
        const el = document.createElement('textarea')
        el.style.cssText =
          'position:fixed;opacity:0;width:1px;height:1px;padding:0;border:0;top:50%;left:50%;overflow:hidden;resize:none;'
        el.autocomplete = 'off'
        el.setAttribute('autocorrect', 'off')
        el.setAttribute('autocapitalize', 'none')
        el.spellcheck = false
        el.tabIndex = -1
        el.setAttribute('aria-hidden', 'true')
        document.body.appendChild(el)
        textareaRef.value = el
        el.focus()
        resetBlink()

        onCleanup(() => {
          clearInterval(blinkTimer)
          el.remove()
          textareaRef.value = null
          isComposing = false
        })
      }
    }
  )
}
