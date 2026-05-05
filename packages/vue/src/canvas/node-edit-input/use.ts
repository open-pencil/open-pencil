import type { Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'

import {
  getCanvasNodeEditState,
  handleBendHandleMove,
  resolveBendTargetHandle,
  type CanvasNodeEditMethods
} from '#vue/canvas/node-edit-input/bend'
import { hitTestEditHandle, isEndpoint, NODE_HIT_THRESHOLD } from '#vue/shared/input/node-edit'
import type { DragState } from '#vue/shared/input/types'

export function updateNodeEditHover(editor: Editor, cx: number, cy: number): boolean {
  const nodeEditState = getCanvasNodeEditState(editor)
  if (!nodeEditState) return false
  const hit = hitTestEditHandle(editor, cx, cy)
  const prev = nodeEditState.hoveredHandleInfo
  if (hit) {
    if (!prev || prev.segmentIndex !== hit.segmentIndex || prev.tangentField !== hit.tangentField) {
      nodeEditState.hoveredHandleInfo = {
        segmentIndex: hit.segmentIndex,
        tangentField: hit.tangentField
      }
      editor.requestRepaint()
    }
  } else if (prev) {
    nodeEditState.hoveredHandleInfo = null
    editor.requestRepaint()
  }
  return true
}

export { handleBendHandleMove, resolveBendTargetHandle }

export function handleNodeEditMouseUp(drag: Ref<DragState | null>, editor: Editor): boolean {
  const nodeEditEditor = editor as Editor & CanvasNodeEditMethods
  const d = drag.value
  if (!d) return false

  if (d.type === 'bend-handle') {
    if (d.lockedMode === null) {
      nodeEditEditor.nodeEditZeroVertexHandles?.(d.vertexIndex)
    }
    drag.value = null
    return true
  }

  if (d.type === 'edit-node') {
    const es = getCanvasNodeEditState(editor)
    if (es && d.origPositions.size === 1) {
      const [draggedIdx] = d.origPositions.keys()
      if (isEndpoint(draggedIdx, es.segments)) {
        const v = es.vertices[draggedIdx]
        const iz = 1 / editor.state.zoom
        for (let i = 0; i < es.vertices.length; i++) {
          if (i === draggedIdx) continue
          if (!isEndpoint(i, es.segments)) continue
          const t = es.vertices[i]
          if (Math.hypot(v.x - t.x, v.y - t.y) < NODE_HIT_THRESHOLD * iz) {
            nodeEditEditor.nodeEditConnectEndpoints?.(draggedIdx, i)
            drag.value = null
            return true
          }
        }
      }
    }
    drag.value = null
    return true
  }

  if (d.type === 'edit-handle') {
    drag.value = null
    return true
  }

  return false
}
