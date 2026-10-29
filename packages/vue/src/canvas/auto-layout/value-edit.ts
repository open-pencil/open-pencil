import { ref } from 'vue'

import type { Editor, NodePreview } from '@open-pencil/core'

import {
  autoLayoutValueField,
  resolveAutoLayoutHover,
  type AutoLayoutValueField
} from '#vue/shared/input/auto-layout-hover'

/**
 * A padding or gap value edited on the canvas, as Figma opens one on a double-click: the editor
 * shows while the edit is open, and the value previews on the frame until it is committed.
 */
export function createAutoLayoutValueEdit(editor: Editor) {
  const autoLayoutValueEdit = ref<{
    nodeId: string
    field: AutoLayoutValueField
    /** The gap a double-click opened the gap's editor on, which it sits over. */
    gap: number
    value: number
  } | null>(null)
  // The edit's owned preview: undo takes it back in one step, and a selection, page, or
  // document change cancels it, which closes the editor.
  let valuePreview: NodePreview | null = null
  let stopValuePreview: Array<() => void> = []

  function end() {
    for (const stop of stopValuePreview) stop()
    stopValuePreview = []
    valuePreview = null
    autoLayoutValueEdit.value = null
  }

  function start(cx: number, cy: number): boolean {
    const hover = resolveAutoLayoutHover(cx, cy, editor)
    const field = hover ? autoLayoutValueField(hover) : null
    const node = hover ? editor.graph.getNode(hover.nodeId) : undefined
    if (!hover || !field || !node) return false
    valuePreview = editor.beginNodePreview(
      field === 'itemSpacing' ? 'Update gap' : 'Update padding'
    )
    const close = () => {
      if (valuePreview?.closed) end()
    }
    stopValuePreview = (['selection:changed', 'page:changed', 'graph:replaced'] as const).map(
      (event) => editor.onEditorEvent(event, close)
    )
    // The preview tracks the frame only once a value changes, so its deletion closes the editor here.
    stopValuePreview.push(
      editor.onEditorEvent('node:deleted', (id) => {
        if (id === node.id) valuePreview?.cancel()
        close()
      })
    )
    autoLayoutValueEdit.value = {
      nodeId: node.id,
      field,
      gap: hover.index ?? 0,
      value: node[field]
    }
    return true
  }

  function update(value: number) {
    const edit = autoLayoutValueEdit.value
    if (!edit || !valuePreview || !Number.isFinite(value)) return
    const next = Math.max(0, value)
    autoLayoutValueEdit.value = { ...edit, value: next }
    valuePreview.update(edit.nodeId, { [edit.field]: next })
  }

  function commit(value: number) {
    const edit = autoLayoutValueEdit.value
    if (edit && valuePreview && Number.isFinite(value)) {
      valuePreview.update(edit.nodeId, { [edit.field]: Math.max(0, value) })
      valuePreview.commit()
    } else {
      valuePreview?.cancel()
    }
    end()
  }

  function cancel() {
    valuePreview?.cancel()
    end()
  }

  return { edit: autoLayoutValueEdit, start, update, commit, cancel }
}
