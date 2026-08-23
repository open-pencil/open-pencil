import type { Editor } from '@open-pencil/core/editor'
import { collectResizeDescendants, createResizeSnapshot } from '@open-pencil/scene-graph/resize'

import { getHitHandleByMatrix } from '#vue/shared/input/geometry'
import type { DragResize } from '#vue/shared/input/types'

export function tryStartResize(cx: number, cy: number, editor: Editor): DragResize | null {
  for (const id of editor.state.selectedIds) {
    const node = editor.graph.getNode(id)
    if (!node || node.locked) continue
    const handleResult = getHitHandleByMatrix(cx, cy, node, editor.graph, editor.renderer?.zoom)
    if (handleResult) {
      const snap = createResizeSnapshot(node)
      return {
        type: 'resize',
        handle: handleResult.handle,
        startX: cx,
        startY: cy,
        origRect: { x: node.x, y: node.y, width: node.width, height: node.height },
        nodeId: id,
        origVectorNetwork: snap.vectorNetwork,
        origFillGeometry: snap.fillGeometry,
        origStrokeGeometry: snap.strokeGeometry,
        origDerivedTextGlyphs: snap.derivedTextGlyphs,
        origStrokes: snap.strokes,
        origTextPathData: snap.textPathData,
        origTextPathBox: snap.textPathBox,
        origChildren: collectResizeDescendants(editor.graph, id),
        appliedRect: { x: node.x, y: node.y, width: node.width, height: node.height }
      }
    }
  }
  return null
}
