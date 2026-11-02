import type { Editor } from '@open-pencil/core'
import { layerResizes } from '@open-pencil/scene-graph/generated'
import { enforcedAspectRatio } from '@open-pencil/scene-graph/layout'
import { collectResizeDescendants, createResizeSnapshot } from '@open-pencil/scene-graph/resize'

import { getHitHandleByMatrix } from '#vue/shared/input/geometry'
import type { DragResize } from '#vue/shared/input/types'

export function tryStartResize(cx: number, cy: number, editor: Editor): DragResize | null {
  for (const id of editor.state.selectedIds) {
    const node = editor.graph.getNode(id)
    // A sticky note only scales, from its corners; see `tryStartStickyScale`. A connector is
    // shaped by its ends.
    if (!node || node.locked || !layerResizes(node)) continue
    const handleResult = getHitHandleByMatrix(
      cx,
      cy,
      node,
      editor.graph,
      editor.renderer?.zoom,
      editor.state.rotationPreview
    )
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
        lockedAspectRatio: enforcedAspectRatio(node),
        appliedRect: { x: node.x, y: node.y, width: node.width, height: node.height }
      }
    }
  }
  return null
}
