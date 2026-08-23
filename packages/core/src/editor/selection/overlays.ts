import type { Rect } from '@open-pencil/scene-graph/primitives'
import type { SnapGuide } from '@open-pencil/scene-graph/snap'

import type { GuidePreview } from '#core/canvas/guides/types'
import type { EditorContext } from '#core/editor/types'

export function createSelectionOverlayActions(ctx: EditorContext) {
  function setMarquee(rect: Rect | null) {
    ctx.state.marquee = rect
    ctx.requestRepaint()
  }

  function setSnapGuides(guides: SnapGuide[]) {
    ctx.state.snapGuides = guides
    ctx.requestRepaint()
  }

  function setGuidePreview(preview: GuidePreview | null) {
    ctx.state.guides.preview = preview
    ctx.requestRepaint()
  }

  function setHoveredGuide(selection: typeof ctx.state.guides.hovered) {
    const current = ctx.state.guides.hovered
    if (current?.ownerId === selection?.ownerId && current?.guideId === selection?.guideId) return
    ctx.state.guides.hovered = selection
    ctx.requestRepaint()
  }

  function setGuideRedline(redline: typeof ctx.state.guides.redline) {
    ctx.state.guides.redline = redline
    ctx.requestRepaint()
  }

  function setSelectedGuide(selection: typeof ctx.state.guides.selected) {
    ctx.state.guides.selected = selection
    if (selection) ctx.setSelectedIds(new Set())
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

  function setMeasurementMode(mode: typeof ctx.state.measurementMode) {
    if (ctx.state.measurementMode === mode) return
    ctx.state.measurementMode = mode
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
    setGuidePreview,
    setHoveredGuide,
    setGuideRedline,
    setSelectedGuide,
    setRotationPreview,
    setHoveredNode,
    setMeasurementMode,
    setDropTarget,
    setLayoutInsertIndicator,
    setAutoLayoutHover
  }
}
