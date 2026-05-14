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
    if (ctx.state.dropTargetId === id) return
    ctx.state.dropTargetId = id
    ctx.requestRepaint()
  }

  function setLayoutInsertIndicator(indicator: typeof ctx.state.layoutInsertIndicator) {
    if (ctx.state.layoutInsertIndicator === indicator) return
    ctx.state.layoutInsertIndicator = indicator
    ctx.requestRepaint()
  }

  function setAutoLayoutHover(hover: typeof ctx.state.autoLayoutHover) {
    const current = ctx.state.autoLayoutHover
    if (
      current?.nodeId === hover?.nodeId &&
      current?.kind === hover?.kind &&
      current?.index === hover?.index &&
      current?.side === hover?.side
    ) {
      return
    }
    ctx.state.autoLayoutHover = hover
    ctx.requestRepaint()
  }

  return {
    setMarquee,
    setSnapGuides,
    setRotationPreview,
    setHoveredNode,
    setDropTarget,
    setLayoutInsertIndicator,
    setAutoLayoutHover
  }
}
