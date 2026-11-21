// Figma's snapping while a move changes frames: layers dragged over a frame snap to that frame and
// the layers in it, where a drop puts them, not to the parent they are leaving.
import type { Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'

import { enclosingContainer } from '#vue/shared/input/drop-target'
import type { DragMove } from '#vue/shared/input/types'

/**
 * The parent whose layers and edges the move snaps to: the frame or page a drop here puts the
 * layers in, or `parentId`, the one holding them, when the drop keeps them there.
 */
export function moveSnapScope(
  d: DragMove,
  dropTarget: SceneNode | null,
  parentId: string,
  editor: Editor
): string {
  if (d.keepParents) return parentId

  const firstId = d.originals.keys().next().value
  const landing = dropTarget?.id ?? editor.state.currentPageId
  if (!firstId || enclosingContainer(firstId, editor) === landing) return parentId
  return landing
}
