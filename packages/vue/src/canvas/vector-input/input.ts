import type { Ref } from 'vue'

import type { Editor } from '@open-pencil/core'

import {
  getCanvasNodeEditState,
  handleBendHandleMove,
  resolveBendTargetHandle,
  type CanvasNodeEditMethods
} from '#vue/canvas/vector-input/bend'
import type { DragState } from '#vue/shared/input/types'
import {
  finishNodeEditMarquee,
  getNodeEditState,
  hitTestEditHandle,
  hitTestEditRegion,
  isEndpoint,
  finishPartClick,
  NODE_HIT_THRESHOLD
} from '#vue/shared/input/vector'

export function updateNodeEditHover(editor: Editor, cx: number, cy: number): boolean {
  const state = getCanvasNodeEditState(editor)
  if (!state) return false
  const hit = hitTestEditHandle(editor, cx, cy)
  const previous = state.hoveredHandleInfo
  if (hit) {
    if (
      !previous ||
      previous.segmentIndex !== hit.segmentIndex ||
      previous.tangentField !== hit.tangentField
    ) {
      state.hoveredHandleInfo = { segmentIndex: hit.segmentIndex, tangentField: hit.tangentField }
      editor.requestRepaint()
    }
  } else if (previous) {
    state.hoveredHandleInfo = null
    editor.requestRepaint()
  }
  // The region under the pointer is hatched, as in Figma, unless a handle is under it.
  const es = getNodeEditState(editor)
  const region = hit ? null : hitTestEditRegion(editor, cx, cy)
  if (es && (es.hoveredRegion ?? null) !== region) {
    es.hoveredRegion = region
    editor.requestRepaint()
  }
  return true
}

export { handleBendHandleMove, resolveBendTargetHandle }

export function handleNodeEditPointerUp(drag: Ref<DragState | null>, editor: Editor): boolean {
  const methods = editor as Editor & CanvasNodeEditMethods
  const current = drag.value
  if (!current) return false
  if (current.type === 'bend-handle') {
    editor.setSnapGuides([])
    if (current.lockedMode === null) methods.nodeEditZeroVertexHandles?.(current.vertexIndex)
    methods.commitNodeEditChanges?.()
    drag.value = null
    return true
  }
  if (current.type === 'edit-node') {
    editor.setSnapGuides([])
    finishPartClick(current, editor)
    const state = getCanvasNodeEditState(editor)
    if (state && current.origPositions.size === 1) {
      const [draggedIndex] = current.origPositions.keys()
      if (isEndpoint(draggedIndex, state.segments)) {
        const vertex = state.vertices[draggedIndex]
        const threshold = NODE_HIT_THRESHOLD / editor.state.zoom
        for (let index = 0; index < state.vertices.length; index++) {
          if (index === draggedIndex || !isEndpoint(index, state.segments)) continue
          const target = state.vertices[index]
          if (Math.hypot(vertex.x - target.x, vertex.y - target.y) < threshold) {
            methods.nodeEditConnectEndpoints?.(draggedIndex, index)
            break
          }
        }
      }
    }
    methods.commitNodeEditChanges?.()
    drag.value = null
    return true
  }
  if (current.type === 'edit-marquee') {
    finishNodeEditMarquee(editor)
    drag.value = null
    return true
  }
  if (current.type === 'edit-handle') {
    editor.setSnapGuides([])
    methods.commitNodeEditChanges?.()
    drag.value = null
    return true
  }
  return false
}

/** Abandons a drag on a path being edited: puts dragged points back, or drops the marquee. */
export function cancelNodeEditDrag(current: DragState | null, editor: Editor) {
  if (
    current?.type === 'edit-node' ||
    current?.type === 'edit-handle' ||
    current?.type === 'bend-handle'
  ) {
    ;(editor as Editor & CanvasNodeEditMethods).nodeEditCancelDrag?.()
  }
  if (current?.type === 'edit-marquee') editor.setMarquee(null)
}
