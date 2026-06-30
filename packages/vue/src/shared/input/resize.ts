export { constrainToAspectRatio } from '#vue/shared/input/resize/rect'
export { tryStartResize } from '#vue/shared/input/resize/start'
import type { Editor } from '@open-pencil/core/editor'
import { computeLayout } from '@open-pencil/core/layout'
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
  return { changes, newRect }
}

export function applyResize(
  d: DragResize,
  cx: number,
  cy: number,
  constrain: boolean,
  editor: Editor
) {
  const { changes, newRect } = resizeChanges(d, cx, cy, constrain)
  editor.graph.updateNodePreview(d.nodeId, changes)

  if (d.origChildren && d.origRect.width > 0 && d.origRect.height > 0) {
    const sx = newRect.width / d.origRect.width
    const sy = newRect.height / d.origRect.height
    for (const [childId, orig] of d.origChildren) {
      const childWidth = Math.round(Math.max(1, orig.width * sx))
      const childHeight = Math.round(Math.max(1, orig.height * sy))
      const childChanges: Partial<SceneNode> = {
        x: Math.round(orig.x * sx),
        y: Math.round(orig.y * sy),
        width: childWidth,
        height: childHeight
      }
      if (orig.vectorNetwork) {
        const scaledVN = scaleVectorNetworkForResize(
          orig.vectorNetwork,
          orig.width,
          orig.height,
          childWidth,
          childHeight
        )
        if (scaledVN) childChanges.vectorNetwork = scaledVN
      }
      editor.graph.updateNodePreview(childId, childChanges)
      editor.renderer?.invalidateVectorPath(childId)
    }
  }

  const node = editor.graph.getNode(d.nodeId)
  if (node?.layoutMode !== 'NONE') {
    editor.graph.runPreviewUpdates(() => computeLayout(editor.graph, d.nodeId))
  }
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

  if (d.origChildren) {
    const finalChildren = new Map<string, Partial<SceneNode>>()
    for (const [childId] of d.origChildren) {
      const child = editor.graph.getNode(childId)
      if (!child) continue
      const final: Partial<SceneNode> = {
        x: child.x,
        y: child.y,
        width: child.width,
        height: child.height
      }
      if (child.vectorNetwork) final.vectorNetwork = child.vectorNetwork
      finalChildren.set(childId, final)
    }
    editor.graph.updateNodePreview(d.nodeId, d.origRect)
    for (const [childId, orig] of d.origChildren) {
      editor.graph.updateNodePreview(childId, orig)
    }
    editor.updateNode(d.nodeId, finalChanges)
    for (const [childId, final] of finalChildren) {
      editor.updateNode(childId, final)
    }
    editor.commitGroupResize(d.nodeId, d.origRect, d.origChildren)
    editor.requestRepaint()
  } else {
    editor.graph.updateNodePreview(d.nodeId, d.origRect)
    editor.updateNode(d.nodeId, finalChanges)
    editor.commitResize(d.nodeId, {
      ...d.origRect,
      ...(d.origVectorNetwork || node.vectorNetwork ? { vectorNetwork: d.origVectorNetwork } : {})
    })
  }
}
