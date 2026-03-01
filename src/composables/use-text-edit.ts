import { useEventListener } from '@vueuse/core'
import { shallowRef, watch, type Ref } from 'vue'

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

  function syncText(nodeId: string, text: string) {
    store.graph.updateNode(nodeId, { text })
    store.requestRender()
  }

  function onCompositionStart() {
    isComposing = true
  }

  function onCompositionEnd(e: CompositionEvent) {
    isComposing = false
    if (!e.data) return
    const editor = store.textEditor
    const node = getEditingNode()
    if (!editor || !node) return
    editor.insert(e.data, node)
    syncText(node.id, editor.state?.text ?? '')
    if (textareaRef.value) textareaRef.value.value = ''
    resetBlink()
  }

  function onInput() {
    const el = textareaRef.value
    if (isComposing || !el) return
    const text = el.value
    if (!text) return
    el.value = ''

    const editor = store.textEditor
    const node = getEditingNode()
    if (!editor || !node) return
    editor.insert(text, node)
    syncText(node.id, editor.state?.text ?? '')
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
        editor.insert('\n', node)
        textChanged = true
        break
      case 'Backspace':
        if (isMeta) {
          editor.moveToLineStart(true)
          editor.backspace(node)
        } else if (e.altKey) {
          editor.moveWordLeft(true)
          editor.backspace(node)
        } else {
          editor.backspace(node)
        }
        textChanged = true
        break
      case 'Delete':
        if (isMeta) {
          editor.moveToLineEnd(true)
          editor.delete(node)
        } else if (e.altKey) {
          editor.moveWordRight(true)
          editor.delete(node)
        } else {
          editor.delete(node)
        }
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
          handlePaste(node)
          e.preventDefault()
        }
        return
      default:
        return
    }

    if (textChanged) {
      syncText(node.id, editor.state?.text ?? '')
    } else {
      store.requestRender()
    }
    resetBlink()
    e.preventDefault()
  }

  function handleCopy() {
    const editor = store.textEditor
    if (!editor) return
    const text = editor.getSelectedText()
    if (text) navigator.clipboard.writeText(text)
  }

  function handleCut(node: ReturnType<typeof getEditingNode>) {
    const editor = store.textEditor
    if (!editor || !node) return
    const text = editor.getSelectedText()
    if (text) {
      navigator.clipboard.writeText(text)
      editor.backspace(node)
      syncText(node.id, editor.state?.text ?? '')
      resetBlink()
    }
  }

  async function handlePaste(node: ReturnType<typeof getEditingNode>) {
    const editor = store.textEditor
    if (!editor || !node) return
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        editor.insert(text, node)
        syncText(node.id, editor.state?.text ?? '')
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
