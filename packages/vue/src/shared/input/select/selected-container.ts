// Figma's press inside a selected frame: a frame whose layers a click reaches, such as a top-level
// frame or an inserted icon, still moves as a whole when dragged from inside while selected, and
// a click without a drag then selects the layer under the press.
import { resolveEditorProfile, type Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'

import { selectionIsLocked } from '#vue/shared/input/select/move'
import type { DragMove } from '#vue/shared/input/types'

/**
 * The selected open container holding the pressed layer, which the press drags instead of it. A
 * selection that cannot move, read-only or locked, leaves the press to select the layer at once.
 */
export function selectedContainerHolding(hit: SceneNode, editor: Editor): string | undefined {
  const { framesOpen, layerEdits } = resolveEditorProfile(editor.state)
  if (layerEdits === 'none' || selectionIsLocked(editor)) return undefined

  return [...editor.state.selectedIds].find(
    (id) =>
      id !== hit.id &&
      editor.graph.isDescendant(hit.id, id) &&
      editor.graph.isOpenContainer(id, framesOpen)
  )
}

/** Selects the layer a press inside a selected container reached, once the press ends unmoved. */
export function selectClickedLayer(d: DragMove, editor: Editor): void {
  const id = d.clickSelectsId
  if (!id || !editor.graph.getNode(id)) return

  editor.select([id])
  editor.enterContainerOf(id)
}
