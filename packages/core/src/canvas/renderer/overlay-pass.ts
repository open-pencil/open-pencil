import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { drawGuides } from '#core/canvas/guides/draw'
import { drawIssueHighlight, drawIssueMarkers } from '#core/canvas/issues/draw'
import { placeIssueMarkers } from '#core/canvas/issues/layout'
import { drawComponentLabels, drawFrameTitles, drawSectionTitles } from '#core/canvas/labels/draw'
import { cachedGlyphWidth } from '#core/canvas/labels/paragraph-cache'
import { drawNodeEditOverlay } from '#core/canvas/node-edit-overlay'
import {
  drawAutoLayoutHover,
  drawEnteredContainer,
  drawFlashes,
  drawHoverHighlight,
  drawLayoutInsertIndicator,
  drawMarquee,
  drawMeasurements,
  drawPresenceCursors,
  drawSelection,
  drawSnapGuides,
  drawSnapMarks
} from '#core/canvas/overlays'
import { drawAIOverlays } from '#core/canvas/overlays/ai'
import { drawComponentSetBorders } from '#core/canvas/overlays/component-sets'
import { drawConnectorTarget } from '#core/canvas/overlays/connectors'
import { drawDropTarget, drawEditingText } from '#core/canvas/overlays/feedback'
import { drawGradientHandles } from '#core/canvas/overlays/gradient-handles'
import { drawLayoutOutlines } from '#core/canvas/overlays/layout-outlines'
import { drawMeasurementSegment } from '#core/canvas/overlays/measurement'
import { drawPixelGrid } from '#core/canvas/overlays/pixel-grid'
import { drawCodeFocus } from '#core/canvas/overlays/selection'
import { drawShapeHandles } from '#core/canvas/overlays/shape-handles'
import { drawSlotOutlines } from '#core/canvas/overlays/slots'
import { drawPenOverlay, drawPencilOverlay } from '#core/canvas/pen-overlay'
import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'
import { drawRulers } from '#core/canvas/rulers'
import { RULER_SIZE } from '#core/constants'
import { editedGradient } from '#core/editor/gradient-edit'

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
  drawFrameTitles(r, canvas, graph, selectedIds, overlays)
  profiler.endPhase('render:frameTitles')
  profiler.beginPhase('render:sectionTitles')
  drawSectionTitles(r, canvas, graph, overlays)
  profiler.endPhase('render:sectionTitles')
  profiler.beginPhase('render:componentLabels')
  drawComponentLabels(r, canvas, graph, overlays)
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
 * The layers are staged in world space once per change; a frame places the stage in its viewport.
 */
function updateIssueMarkers(
  r: SkiaRenderer,
  graph: SceneGraph,
  overlays: RenderOverlays,
  sceneVersion: number
): void {
  const markers = overlays.designIssues?.markers
  if (!markers || markers.length === 0 || overlays.penState) {
    r.issueMarkers = []
    r.issueMarkerStage.clear()
    return
  }
  const staged = r.issueMarkerStage.update(
    graph,
    markers,
    {
      pageId: r.pageId ?? '',
      suppressedIds: suppressedIssueIds(overlays),
      preview: overlays.rotationPreview
    },
    sceneVersion,
    graph.positionPreviewVersion
  )
  const measureText = (text: string) =>
    r.chromeFonts.size ? cachedGlyphWidth(r, r.chromeFonts.size, text) : 0
  const inset = r.showRulers ? RULER_SIZE : 0
  r.issueMarkers = placeIssueMarkers(staged, {
    view: {
      panX: r.panX,
      panY: r.panY,
      zoom: r.zoom,
      width: r.viewportWidth,
      height: r.viewportHeight,
      insetTop: inset,
      insetLeft: inset
    },
    measureText,
    obstacles: r.overlayObstacles
  })
}

export function drawOverlayPass(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays: RenderOverlays,
  sceneVersion: number
): void {
  const measuring = measurementVisible(overlays)
  const hoveredNodeId =
    measuring || overlays.hoveredNodeId === overlays.nodeEditState?.nodeId
      ? null
      : overlays.hoveredNodeId
  // Over the design and under every editing outline, as in Figma.
  if (overlays.showPixelGrid) drawPixelGrid(r, canvas)
  drawComponentSetBorders(r, canvas, graph, overlays.rotationPreview)
  drawCodeFocus(r, canvas, graph, overlays.codeFocusNodeId, overlays.rotationPreview)
  if (!measuring)
    drawSlotOutlines(r, canvas, graph, selectedIds, hoveredNodeId, overlays.rotationPreview)
  if (!measuring) drawLayoutOutlines(r, canvas, graph, selectedIds, hoveredNodeId, overlays)
  drawHoverHighlight(r, canvas, graph, hoveredNodeId, overlays.rotationPreview)
  drawIssueHighlight(r, canvas, graph, overlays.designIssues?.highlight, overlays.rotationPreview)
  drawEnteredContainer(r, canvas, graph, overlays.enteredContainerId, overlays.rotationPreview)
  drawDropTarget(r, canvas, graph, overlays.dropTargetId, overlays.rotationPreview)
  drawConnectorTarget(r, canvas, graph, overlays.connectorTarget, overlays.rotationPreview)
  drawEditingText(r, canvas, graph, overlays)
  r.profiler.beginPhase('render:selection')
  // While a gradient is edited, Figma shows its handles instead of the layer's selection; a
  // previewing canvas shows neither.
  if (!overlays.playing && editedGradient(graph, overlays.gradientEdit))
    drawGradientHandles(r, canvas, graph, overlays.gradientEdit, overlays.rotationPreview)
  else {
    drawSelection(r, canvas, graph, selectedIds, overlays)
    if (!overlays.transforming && r.editHandles)
      drawShapeHandles(
        r,
        canvas,
        graph,
        selectedIds,
        overlays.shapeHandleHover,
        overlays.rotationPreview
      )
  }
  if (measuring) drawMeasurements(r, canvas, graph, selectedIds, overlays.hoveredNodeId)
  r.profiler.endPhase('render:selection')

  drawFlashes(r, canvas, graph)
  drawAIOverlays(r, canvas, graph)
  if (overlays.guides?.redline) drawMeasurementSegment(r, canvas, overlays.guides.redline.segment)
  drawGuides(r, canvas, graph, overlays.guides)
  drawSnapGuides(r, canvas, overlays.snapGuides)
  drawMarquee(r, canvas, overlays.marquee)
  drawLayoutInsertIndicator(r, canvas, overlays.layoutInsertIndicator)
  if (!measuring && !overlays.transforming && r.editHandles) {
    drawAutoLayoutHover(r, canvas, graph, overlays.autoLayoutHover)
  }
  drawNodeEditOverlay(r, canvas, graph, overlays.nodeEditState)
  drawPenOverlay(r, canvas, overlays.penState)
  drawPencilOverlay(r, canvas, overlays.pencilState)
  drawSnapMarks(r, canvas, overlays.snapGuides)
  updateIssueMarkers(r, graph, overlays, sceneVersion)
  drawIssueMarkers(r, canvas, r.issueMarkers, overlays.designIssues?.hoveredMarkerKey)
  drawPresenceCursors(r, canvas, graph, overlays.presenceCursors)
}

export function drawChromePass(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays: RenderOverlays
): void {
  r.profiler.beginPhase('render:rulers')
  if (r.showRulers) drawRulers(r, canvas, graph, selectedIds, overlays.guides)
  r.profiler.endPhase('render:rulers')
  r.profiler.drawHUD(canvas, r.showRulers)
}
