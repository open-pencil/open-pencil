import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { drawGuides } from '#core/canvas/guides/draw'
import { drawMeasurementSegment } from '#core/canvas/overlays/measurement'
import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'

function measurementVisible(overlays: RenderOverlays): boolean {
  return (
    overlays.measurementMode !== undefined &&
    overlays.measurementMode !== 'off' &&
    !overlays.editingTextId &&
    !overlays.nodeEditState &&
    !overlays.penState
  )
}

export function drawLabelPass(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph): void {
  const profiler = r.profiler
  profiler.beginPhase('render:sectionTitles')
  r.drawSectionTitles(canvas, graph)
  profiler.endPhase('render:sectionTitles')
  profiler.beginPhase('render:componentLabels')
  r.drawComponentLabels(canvas, graph)
  profiler.endPhase('render:componentLabels')
}

export function drawOverlayPass(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays: RenderOverlays
): void {
  const measuring = measurementVisible(overlays)
  const hoveredNodeId =
    measuring || overlays.hoveredNodeId === overlays.nodeEditState?.nodeId
      ? null
      : overlays.hoveredNodeId
  r.drawHoverHighlight(canvas, graph, hoveredNodeId)
  r.drawEnteredContainer(canvas, graph, overlays.enteredContainerId)
  r.profiler.beginPhase('render:selection')
  r.drawSelection(canvas, graph, selectedIds, overlays)
  if (measuring) r.drawMeasurements(canvas, graph, selectedIds, overlays.hoveredNodeId)
  r.profiler.endPhase('render:selection')

  r.drawFlashes(canvas, graph)
  if (overlays.guides?.redline) drawMeasurementSegment(r, canvas, overlays.guides.redline.segment)
  drawGuides(r, canvas, graph, overlays.guides)
  r.drawSnapGuides(canvas, overlays.snapGuides)
  r.drawMarquee(canvas, overlays.marquee)
  r.drawLayoutInsertIndicator(canvas, overlays.layoutInsertIndicator)
  if (!measuring) r.drawAutoLayoutHover(canvas, graph, overlays.autoLayoutHover)
  r.drawNodeEditOverlay(canvas, graph, overlays.nodeEditState)
  r.drawPenOverlay(canvas, overlays.penState)
  r.drawRemoteCursors(canvas, graph, overlays.remoteCursors)
}

export function drawChromePass(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays: RenderOverlays
): void {
  r.profiler.beginPhase('render:rulers')
  if (r.showRulers) r.drawRulers(canvas, graph, selectedIds, overlays.guides)
  r.profiler.endPhase('render:rulers')
  r.profiler.drawHUD(canvas, r.showRulers)
}
