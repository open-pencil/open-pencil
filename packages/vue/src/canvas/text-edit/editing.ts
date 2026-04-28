import { useIntervalFn } from '@vueuse/core'

import { adjustRunsForDelete, adjustRunsForInsert } from '@open-pencil/core/text'

import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/core/scene-graph'
import type { ShallowRef } from 'vue'

const CARET_BLINK_MS = 530

export function createCaretBlink(store: Editor) {
  const { pause, resume } = useIntervalFn(
    () => {
      if (!store.textEditor) return
      store.textEditor.caretVisible = !store.textEditor.caretVisible
      store.requestRepaint()
    },
    CARET_BLINK_MS,
    { immediate: false }
  )

  function resetBlink() {
    if (store.textEditor) store.textEditor.caretVisible = true
    pause()
    resume()
    store.requestRepaint()
  }

  return { resetBlink, stopBlink: pause }
}

type TextCompositionOptions = {
  textareaRef: ShallowRef<HTMLTextAreaElement | null>
  getEditingNode: () => SceneNode | null
  insertText: (text: string, node: SceneNode) => void
  resetBlink: () => void
}

export function createTextCompositionHandlers({
  textareaRef,
  getEditingNode,
  insertText,
  resetBlink
}: TextCompositionOptions) {
  let isComposing = false

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

  function resetComposition() {
    isComposing = false
  }

  return { isComposing: () => isComposing, onCompositionStart, onCompositionEnd, onInput, resetComposition }
}

export function createTextEditActions(store: Editor) {
  function getEditingNode() {
    const id = store.state.editingTextId
    if (!id) return null
    return store.graph.getNode(id) ?? null
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

  return { getEditingNode, insertText, deleteText }
}
