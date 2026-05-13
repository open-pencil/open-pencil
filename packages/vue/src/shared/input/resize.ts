export { constrainToAspectRatio } from '#vue/shared/input/resize/rect'
export { tryStartResize } from '#vue/shared/input/resize/start'
import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/core/scene-graph'

import { calculateResizeRect } from '#vue/shared/input/resize/rect'
import { scaleVectorNetworkForResize } from '#vue/shared/input/resize/vector'
import type { DragResize } from '#vue/shared/input/types'

function resizeChanges(d: DragResize, cx: number, cy: number, constrain: boolean) {
  const { origRect } = d
  const newRect = calculateResizeRect(d.handle, origRect, cx - d.startX, cy - d.startY, constrain)

  const changes: Partial<SceneNode> = { ...newRect }

  const resizedVectorNetwork = scaleVectorNetworkForResize(
    d.origVectorNetwork,
    origRect.width,
    origRect.height,
    newRect.width,
    newRect.height
  )
  if (resizedVectorNetwork) changes.vectorNetwork = resizedVectorNetwork
  return changes
}

export function applyResize(
  d: DragResize,
  cx: number,
  cy: number,
  constrain: boolean,
  editor: Editor
) {
  editor.graph.updateNodePreview(d.nodeId, resizeChanges(d, cx, cy, constrain))
  editor.requestRepaint()
}

export function commitResizePreview(d: DragResize, editor: Editor) {
  const node = editor.graph.getNode(d.nodeId)
  if (!node) return
  const finalChanges: Partial<SceneNode> = {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height
  }
  if (node.vectorNetwork) finalChanges.vectorNetwork = node.vectorNetwork
  editor.graph.updateNodePreview(d.nodeId, d.origRect)
  editor.updateNode(d.nodeId, finalChanges)
  editor.commitResize(d.nodeId, d.origRect)
}
