import type { Editor } from '@open-pencil/core/editor'
import { cloneVectorNetwork } from '@open-pencil/core/scene-graph'

import { getHitHandleByMatrix } from '#vue/shared/input/geometry'
import type { DragResize } from '#vue/shared/input/types'

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
        origVectorNetwork: node.vectorNetwork ? cloneVectorNetwork(node.vectorNetwork) : null
      }
    }
  }
  return null
}
