import { useEventListener } from '@vueuse/core'
import { shallowRef, watch, type Ref } from 'vue'

import {
  adjustRunsForDelete,
  adjustRunsForInsert,
  toggleBoldInRange,
  toggleDecorationInRange,
  toggleItalicInRange
} from '@/engine/style-runs'

import type { SceneNode } from '@/engine/scene-graph'
import type { EditorStore } from '@/stores/editor'

const CARET_BLINK_MS = 530

export function useTextEdit(canvasRef: Ref<HTMLCanvasElement | null>, store: EditorStore) {
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

  function onKeyDown(e: KeyboardEvent) {
    if (isComposing) return
    const editor = store.textEditor
    const node = getEditingNode()
    if (!editor || !node) return

    const isMeta = e.metaKey || e.ctrlKey
    let textChanged = false

    switch (e.key) {
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
        if (isMeta) {
          editor.moveToLineStart(true)
        } else if (e.altKey) {
          editor.moveWordLeft(true)
        }
        deleteText(node, false)
        textChanged = true
        break
      case 'Delete':
        if (isMeta) {
          editor.moveToLineEnd(true)
        } else if (e.altKey) {
          editor.moveWordRight(true)
        }
        deleteText(node, true)
        textChanged = true
        break
      case 'ArrowLeft':
        if (isMeta) {
          editor.moveToLineStart(e.shiftKey)
        } else if (e.altKey) {
          editor.moveWordLeft(e.shiftKey)
        } else {
          editor.moveLeft(e.shiftKey)
        }
        break
      case 'ArrowRight':
        if (isMeta) {
          editor.moveToLineEnd(e.shiftKey)
        } else if (e.altKey) {
          editor.moveWordRight(e.shiftKey)
        } else {
          editor.moveRight(e.shiftKey)
        }
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
      case 'a':
        if (isMeta) {
          editor.selectAll()
          break
        }
        return
      case 'c':
        if (isMeta) {
          handleCopy()
          e.preventDefault()
        }
        return
      case 'x':
        if (isMeta) {
          handleCut(node)
          e.preventDefault()
        }
        return
      case 'v':
        if (isMeta) {
          void handlePaste(node)
          e.preventDefault()
        }
        return
      case 'b':
        if (isMeta) {
          toggleBold(node)
          e.preventDefault()
        }
        return
      case 'i':
        if (isMeta) {
          toggleItalic(node)
          e.preventDefault()
        }
        return
      case 'u':
        if (isMeta) {
          toggleUnderline(node)
          e.preventDefault()
        }
        return
      default:
        return
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
    } catch {
      // Clipboard access denied
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
