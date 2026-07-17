import type { Editor } from '@open-pencil/core/editor'
import { cloneVectorNetwork } from '@open-pencil/scene-graph'
import { copyGeometryPaths } from '@open-pencil/scene-graph/copy'

import { getHitHandleByMatrix } from '#vue/shared/input/geometry'
import type { DragResize, OrigChildState } from '#vue/shared/input/types'

function collectDescendants(id: string, editor: Editor): Map<string, OrigChildState> | null {
  const node = editor.graph.getNode(id)
  if (!node || (node.type !== 'GROUP' && node.type !== 'BOOLEAN_OPERATION')) return null
  const map = new Map<string, OrigChildState>()
  const stack = [...node.childIds]
  while (stack.length > 0) {
    const childId = stack.pop()
    if (childId === undefined) break
    const child = editor.graph.getNode(childId)
    if (!child) continue
    map.set(childId, {
      x: child.x,
      y: child.y,
      width: child.width,
      height: child.height,
      vectorNetwork: child.vectorNetwork ? cloneVectorNetwork(child.vectorNetwork) : null,
      fillGeometry: copyGeometryPaths(child.fillGeometry)
    })
    stack.push(...child.childIds)
  }
  return map.size > 0 ? map : null
}

export function tryStartResize(cx: number, cy: number, editor: Editor): DragResize | null {
  for (const id of editor.state.selectedIds) {
    const node = editor.graph.getNode(id)
    if (!node || node.locked) continue
    const handleResult = getHitHandleByMatrix(cx, cy, node, editor.graph, editor.renderer?.zoom)
    if (handleResult) {
      return {
        type: 'resize',
        handle: handleResult.handle,
        startX: cx,
        startY: cy,
        origRect: { x: node.x, y: node.y, width: node.width, height: node.height },
        nodeId: id,
        origVectorNetwork: node.vectorNetwork ? cloneVectorNetwork(node.vectorNetwork) : null,
        origFillGeometry: copyGeometryPaths(node.fillGeometry),
        origChildren: collectDescendants(id, editor)
      }
    }
  }
  return null
}
