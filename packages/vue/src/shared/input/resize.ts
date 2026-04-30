export { constrainToAspectRatio } from '#vue/shared/input/resize/rect'
export { tryStartResize } from '#vue/shared/input/resize/start'
import { calculateResizeRect } from '#vue/shared/input/resize/rect'
import { scaleVectorNetworkForResize } from '#vue/shared/input/resize/vector'

import type { DragResize } from '#vue/shared/input/types'
import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/core/scene-graph'

export function applyResize(
  d: DragResize,
  cx: number,
  cy: number,
  constrain: boolean,
  editor: Editor
) {
  const { origRect } = d
  const newRect = calculateResizeRect(
    d.handle,
    origRect,
    cx - d.startX,
    cy - d.startY,
    constrain
  )

  const changes: Partial<SceneNode> = { ...newRect }

  const resizedVectorNetwork = scaleVectorNetworkForResize(
    d.origVectorNetwork,
    origRect.width,
    origRect.height,
    newRect.width,
    newRect.height
  )
  if (resizedVectorNetwork) changes.vectorNetwork = resizedVectorNetwork

  editor.updateNode(d.nodeId, changes)
}