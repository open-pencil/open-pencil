import type { EditorContext } from '#core/editor/types'
import type { SnapGuide } from '#core/scene-graph/snap'
import type { Rect } from '#core/types'

export function createSelectionOverlayActions(ctx: EditorContext) {
  function setMarquee(rect: Rect | null) {
    ctx.state.marquee = rect
    ctx.requestRepaint()
  }

  function setSnapGuides(guides: SnapGuide[]) {
    ctx.state.snapGuides = guides
    ctx.requestRepaint()
  }

  function setRotationPreview(preview: { nodeId: string; angle: number } | null) {
    ctx.state.rotationPreview = preview
    ctx.requestRepaint()
  }

  function setHoveredNode(id: string | null) {
    if (ctx.state.hoveredNodeId === id) return
    ctx.state.hoveredNodeId = id
    ctx.requestRepaint()
  }

  function setDropTarget(id: string | null) {
    ctx.state.dropTargetId = id
    ctx.requestRepaint()
  }

  function setLayoutInsertIndicator(indicator: typeof ctx.state.layoutInsertIndicator) {
    ctx.state.layoutInsertIndicator = indicator
    ctx.requestRepaint()
  }

  return {
    setMarquee,
    setSnapGuides,
    setRotationPreview,
    setHoveredNode,
    setDropTarget,
    setLayoutInsertIndicator
  }
}
