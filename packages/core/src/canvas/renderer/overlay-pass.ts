import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { drawGuides } from '#core/canvas/guides/draw'
import { drawIssueHighlight, drawIssueMarkers } from '#core/canvas/issues/draw'
import { layoutIssueMarkers } from '#core/canvas/issues/layout'
import { drawLayoutOutlines } from '#core/canvas/overlays/layout-outlines'
import { drawMeasurementSegment } from '#core/canvas/overlays/measurement'
import { drawCodeFocus } from '#core/canvas/overlays/selection'
import { drawSlotOutlines } from '#core/canvas/overlays/slots'
import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'
import { RULER_SIZE } from '#core/constants'

function measurementVisible(overlays: RenderOverlays): boolean {
  return (
    overlays.measurementMode !== undefined &&
    overlays.measurementMode !== 'off' &&
    !overlays.editingTextId &&
    !overlays.nodeEditState &&
    !overlays.penState
  )
}

export function drawLabelPass(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: ReadonlySet<string>,
  overlays?: RenderOverlays
): void {
  const profiler = r.profiler
  profiler.beginPhase('render:frameTitles')
  r.drawFrameTitles(canvas, graph, selectedIds, overlays)
  profiler.endPhase('render:frameTitles')
  profiler.beginPhase('render:sectionTitles')
  r.drawSectionTitles(canvas, graph, overlays)
  profiler.endPhase('render:sectionTitles')
  profiler.beginPhase('render:componentLabels')
  r.drawComponentLabels(canvas, graph, overlays)
  profiler.endPhase('render:componentLabels')
}

function suppressedIssueIds(overlays: RenderOverlays): Set<string> {
  const ids = new Set<string>()
  if (overlays.editingTextId) ids.add(overlays.editingTextId)
  if (overlays.nodeEditState) ids.add(overlays.nodeEditState.nodeId)
  return ids
}

/**
 * Lays out markers for this frame and keeps them for hit testing, so the pointer always targets
 * what is drawn. Markers stay attached to their layers through edits and hide while drawing a path.
 */
function updateIssueMarkers(r: SkiaRenderer, graph: SceneGraph, overlays: RenderOverlays): void {
  const markers = overlays.designIssues?.markers
  if (!markers || markers.length === 0 || overlays.penState) {
    r.issueMarkers = []
    return
  }
  const measureText = (text: string) => {
    const font = r.sizeFont
    if (!font) return 0
    let width = 0
    for (const glyph of font.getGlyphWidths(font.getGlyphIDs(text))) width += glyph
    return width
  }
  const inset = r.showRulers ? RULER_SIZE : 0
  r.issueMarkers = layoutIssueMarkers(graph, markers, {
    pageId: r.pageId ?? '',
    view: {
      panX: r.panX,
      panY: r.panY,
      zoom: r.zoom,
      width: r.viewportWidth,
      height: r.viewportHeight,
      insetTop: inset,
      insetLeft: inset
    },
    suppressedIds: suppressedIssueIds(overlays),
    preview: overlays.rotationPreview,
    measureText,
    obstacles: r.overlayObstacles
  })
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
  drawCodeFocus(r, canvas, graph, overlays.codeFocusNodeId, overlays.rotationPreview)
  if (!measuring)
    drawSlotOutlines(r, canvas, graph, selectedIds, hoveredNodeId, overlays.rotationPreview)
  if (!measuring) drawLayoutOutlines(r, canvas, graph, selectedIds, hoveredNodeId, overlays)
  r.drawHoverHighlight(canvas, graph, hoveredNodeId, overlays.rotationPreview)
  drawIssueHighlight(r, canvas, graph, overlays.designIssues?.highlight, overlays.rotationPreview)
  r.drawEnteredContainer(canvas, graph, overlays.enteredContainerId, overlays.rotationPreview)
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
  if (!measuring && !overlays.transforming) {
    r.drawAutoLayoutHover(canvas, graph, overlays.autoLayoutHover)
  }
  r.drawNodeEditOverlay(canvas, graph, overlays.nodeEditState)
  r.drawPenOverlay(canvas, overlays.penState)
  updateIssueMarkers(r, graph, overlays)
  drawIssueMarkers(r, canvas, r.issueMarkers, overlays.designIssues?.hoveredMarkerKey)
  r.drawPresenceCursors(canvas, graph, overlays.presenceCursors)
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
