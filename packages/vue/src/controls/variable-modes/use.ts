import type { SceneNode } from '@open-pencil/scene-graph'

import { setVariableMode, variableModeChoices } from '#vue/controls/variable-modes/helpers'
import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

/**
 * Returns the variable modes the selection can show, or the current page's when nothing is
 * selected, and the action that sets or clears one.
 *
 * Use this composable for Figma's Apply variable mode control: `choices` lists the collections a
 * mode can be set for, and `applied` those a mode is set for on at least one target, which the
 * panel shows as rows.
 */
export function useVariableModes() {
  const editor = useEditor()

  const targets = useSceneComputed((): SceneNode[] => {
    const selected = [...editor.state.selectedIds]
      .map((id) => editor.getNode(id))
      .filter((node): node is SceneNode => node !== undefined)
    if (selected.length > 0) return selected
    const page = editor.getNode(editor.state.currentPageId)
    return page ? [page] : []
  })
  const choices = useSceneComputed(() => variableModeChoices(editor, targets.value))
  const applied = useSceneComputed(() => choices.value.filter((choice) => choice.value !== null))

  function setMode(collectionId: string, modeId: string | null) {
    setVariableMode(editor, targets.value, collectionId, modeId)
  }

  return { targets, choices, applied, setMode }
}
