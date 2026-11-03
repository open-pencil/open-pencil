import { useIntervalFn } from '@vueuse/core'
import type { ShallowRef } from 'vue'

import type { Editor } from '@open-pencil/core'
import {
  adjustRunsForDelete,
  getStyleAt,
  insertRunsWithStyle,
  runsAfterTyping,
  type TextEditor,
  type TextEditorState
} from '@open-pencil/core/text'
import type { CharacterStyleOverride, SceneNode, StyleRun } from '@open-pencil/scene-graph'
import { paragraphStylesAfterTextChange } from '@open-pencil/scene-graph/text'

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
  replaceComposedText: (text: string, node: SceneNode) => void
  restoreComposition: (node: SceneNode) => void
  finishComposition: () => void
  resetBlink: () => void
}

export function createTextCompositionHandlers({
  textareaRef,
  getEditingNode,
  insertText,
  replaceComposedText,
  restoreComposition,
  finishComposition,
  resetBlink
}: TextCompositionOptions) {
  let isComposing = false
  let skipCommittedInput: { text: string; until: number } | null = null

  function onCompositionStart() {
    isComposing = true
    skipCommittedInput = null
  }

  function updateComposition(text: string) {
    const node = getEditingNode()
    if (!node) return
    replaceComposedText(text, node)
    resetBlink()
  }

  function onCompositionUpdate(e: CompositionEvent) {
    if (!isComposing) return
    updateComposition(e.data)
  }

  function onCompositionEnd(e: CompositionEvent) {
    const finalText = textareaRef.value?.value || e.data || ''
    isComposing = false
    const node = getEditingNode()
    if (!node) {
      finishComposition()
      return
    }

    if (finalText) {
      replaceComposedText(finalText, node)
      finishComposition()
      skipCommittedInput = { text: finalText, until: Date.now() + 250 }
    } else {
      restoreComposition(node)
      finishComposition()
    }
    if (textareaRef.value) textareaRef.value.value = ''
    resetBlink()
  }

  function onInput(event: InputEvent) {
    const el = textareaRef.value
    if (!el) return

    if (isComposing) {
      updateComposition(el.value)
      return
    }

    const text = el.value || event.data || ''
    if (!text) return
    if (text === skipCommittedInput?.text && Date.now() <= skipCommittedInput.until) {
      el.value = ''
      skipCommittedInput = null
      return
    }
    skipCommittedInput = null
    el.value = ''

    const node = getEditingNode()
    if (!node) return
    insertText(text, node)
    resetBlink()
  }

  function resetComposition() {
    isComposing = false
    skipCommittedInput = null
    finishComposition()
  }

  return {
    isComposing: () => isComposing,
    onCompositionStart,
    onCompositionUpdate,
    onCompositionEnd,
    onInput,
    resetComposition
  }
}

function deletedRange(
  editor: TextEditor,
  node: SceneNode,
  forward: boolean
): [number, number] | null {
  const selection = editor.getSelectionRange()
  if (selection) {
    return selection
  }
  const cursor = editor.state?.cursor
  if (cursor === undefined) {
    return null
  }
  if (forward && cursor < node.text.length) {
    return [cursor, cursor + 1]
  }
  if (!forward && cursor > 0) {
    return [cursor - 1, cursor]
  }
  return null
}

export function createTextEditActions(store: Editor) {
  const styleOfEmptiedText = new WeakMap<TextEditorState, CharacterStyleOverride>()

  function emptiedTextStyle(): CharacterStyleOverride {
    const session = store.textEditor?.state
    return (session && styleOfEmptiedText.get(session)) ?? {}
  }

  function runsAfterTypingInSession(
    runs: StyleRun[],
    textLength: number,
    start: number,
    end: number,
    typedLength: number
  ): StyleRun[] {
    if (textLength > 0) {
      return runsAfterTyping(runs, textLength, start, end, typedLength)
    }
    return insertRunsWithStyle([], 0, typedLength, emptiedTextStyle())
  }

  function getEditingNode() {
    const id = store.state.editingTextId
    if (!id) return null
    return store.graph.getNode(id) ?? null
  }

  function syncText(
    nodeId: string,
    text: string,
    runs?: SceneNode['styleRuns'],
    paragraphs?: SceneNode['textParagraphs']
  ) {
    const changes: Partial<SceneNode> = { text }
    if (runs !== undefined) changes.styleRuns = runs
    const node = store.graph.getNode(nodeId)
    if (paragraphs !== undefined) {
      changes.textParagraphs = paragraphs
    } else if (node && node.textParagraphs.length > 0) {
      // A new paragraph continues the list it is typed in; a joined one keeps the first's style.
      changes.textParagraphs = paragraphStylesAfterTextChange(node.textParagraphs, node.text, text)
    }
    store.updateTextEditNode(nodeId, changes)
    const updated = store.graph.getNode(nodeId)
    if (updated) store.textEditor?.rebuildParagraph(updated)
    store.requestRender()
  }

  function insertText(text: string, node: SceneNode) {
    const editor = store.textEditor
    if (!editor) return
    const cursor = editor.state?.cursor ?? 0
    const [start, end] = editor.getSelectionRange() ?? [cursor, cursor]
    const runs = runsAfterTypingInSession(node.styleRuns, node.text.length, start, end, text.length)
    editor.insert(text, node)
    syncText(node.id, editor.state?.text ?? '', runs)
  }

  type CompositionDraft = {
    baseText: string
    baseRuns: SceneNode['styleRuns']
    baseParagraphs: SceneNode['textParagraphs']
    cursor: number
    end: number
    selectionAnchor: number | null
    start: number
  }

  let compositionDraft: CompositionDraft | null = null

  function ensureCompositionDraft(node: SceneNode): CompositionDraft | null {
    const editor = store.textEditor
    const state = editor?.state
    if (!editor || !state) return null
    if (compositionDraft) return compositionDraft

    const range = editor.getSelectionRange()
    const start = range?.[0] ?? state.cursor
    const end = range?.[1] ?? state.cursor
    compositionDraft = {
      baseText: state.text,
      baseRuns: node.styleRuns,
      baseParagraphs: node.textParagraphs,
      cursor: state.cursor,
      end,
      selectionAnchor: state.selectionAnchor,
      start
    }
    return compositionDraft
  }

  function replaceComposedText(text: string, node: SceneNode) {
    const editor = store.textEditor
    const state = editor?.state
    const draft = ensureCompositionDraft(node)
    if (!editor || !state || !draft) return

    state.text = draft.baseText.slice(0, draft.start) + text + draft.baseText.slice(draft.end)
    state.cursor = draft.start + text.length
    state.selectionAnchor = null

    const runs = runsAfterTypingInSession(
      draft.baseRuns,
      draft.baseText.length,
      draft.start,
      draft.end,
      text.length
    )
    // Each update replaces the same base, so paragraphs an earlier update joined come back.
    const paragraphs =
      draft.baseParagraphs.length > 0
        ? paragraphStylesAfterTextChange(draft.baseParagraphs, draft.baseText, state.text)
        : undefined
    syncText(node.id, state.text, runs, paragraphs)
  }

  function restoreComposition(node: SceneNode) {
    const editor = store.textEditor
    const state = editor?.state
    if (!state || !compositionDraft) return
    state.text = compositionDraft.baseText
    state.cursor = compositionDraft.cursor
    state.selectionAnchor = compositionDraft.selectionAnchor
    syncText(
      node.id,
      compositionDraft.baseText,
      compositionDraft.baseRuns,
      compositionDraft.baseParagraphs
    )
    compositionDraft = null
  }

  function finishComposition() {
    compositionDraft = null
  }

  function deleteText(node: SceneNode, forward: boolean) {
    const editor = store.textEditor
    if (!editor) return
    const range = deletedRange(editor, node, forward)
    const runs = range
      ? adjustRunsForDelete(node.styleRuns, range[0], range[1] - range[0])
      : node.styleRuns
    if (forward) {
      editor.delete(node)
    } else {
      editor.backspace(node)
    }
    const session = editor.state
    const text = session?.text ?? ''
    if (session && range && text.length === 0) {
      styleOfEmptiedText.set(session, getStyleAt(node.styleRuns, range[0]))
    }
    syncText(node.id, text, runs)
  }

  return {
    getEditingNode,
    insertText,
    replaceComposedText,
    restoreComposition,
    finishComposition,
    deleteText
  }
}
