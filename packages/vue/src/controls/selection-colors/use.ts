import { computed, shallowRef } from 'vue'

import {
  replaceSelectionColor,
  selectionColors,
  selectionColorsShown,
  type SelectionColor
} from '@open-pencil/core/editor'

import { useUndoBatch } from '#vue/controls/undo-batch/use'
import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

/**
 * Figma's Selection colors for the current selection: each colour its layers and their
 * descendants fill or stroke with, and an edit that recolours every paint using it. While a row's
 * picker is open the list keeps its order, so the row under the picker stays put.
 */
export function useSelectionColors() {
  const editor = useEditor()
  const batch = useUndoBatch(editor.undo, editor.beginInteractiveEdit)
  const ids = useSceneComputed(() => [...editor.state.selectedIds])
  // A move, resize, or rotation changes no colour, so the list is not walked again mid-drag.
  let last: SelectionColor[] = []
  const live = useSceneComputed(() => {
    if (!editor.state.transforming) last = selectionColors(editor.graph, ids.value)
    return last
  })
  const frozen = shallowRef<SelectionColor[] | null>(null)
  const colors = computed(() => frozen.value ?? live.value)
  const shown = useSceneComputed(
    () => live.value.length > 0 && selectionColorsShown(editor.graph, ids.value)
  )

  /** Recolours every paint using the colour in row `index`. */
  function replace(index: number, to: Pick<SelectionColor, 'color' | 'opacity'>) {
    const list = colors.value
    const from = list.at(index)
    if (!from) return
    batch.ensure(`selection-color:${index}`, 'Change selection color')
    for (const { id, changes } of replaceSelectionColor(editor.graph, ids.value, from, to))
      editor.updateNodeWithUndo(id, changes, 'Change selection color')
    if (frozen.value)
      frozen.value = list.map((entry, row) => (row === index ? { ...entry, ...to } : entry))
  }

  /** Starts editing a row in its picker: the list keeps its order until `finish`. */
  function begin() {
    frozen.value = [...live.value]
  }

  /** Ends an edit: commits it as one undo step and lets the list re-sort. */
  function finish() {
    batch.flush()
    frozen.value = null
  }

  return { colors, shown, replace, begin, finish }
}
