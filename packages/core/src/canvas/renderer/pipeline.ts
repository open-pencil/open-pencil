import type { Canvas } from 'canvaskit-wasm'

import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'
import type { EditorState } from '#core/editor/types'
import { computeContentBounds } from '#core/geometry'
import type { SceneGraph, SceneNode } from '#core/scene-graph'

/**
 * Maximum scene graph node count for which the monolithic SkPicture scene
 * cache is used. Above this threshold, every frame is rendered directly
 * with viewport culling to keep per-frame latency proportional to visible
 * area rather than total node count.
 *
 * NOTE: This was originally introduced while investigating a >2GB heap spike
 * caused by pluginData duplication (see serialize.ts upsertPluginData). The
 * actual root cause was a pluginId/pluginID casing typo that accumulated
 * duplicates on every save, not SkPicture itself. The threshold remains
 * useful as a latency optimization for large scenes.
 */
const DIRECT_RENDER_NODE_THRESHOLD = 500

import { renderSceneBacking, updateSceneBackingPreviewState } from './retained-backing'

export function renderSceneToCanvas(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  pageId: string
): void {
  r._absPosFullCache.clear()
  r._absPosFullSceneVersion = -1
  r._absPosFullPageId = pageId
  const prevViewport = r.worldViewport
  const prevMinScreenSize = r.minScreenSize
  const prevMinScreenSizeForText = r.minScreenSizeForText
  const prevMinScreenSizeForEffects = r.minScreenSizeForEffects
  const prevViewportAnimating = r._isViewportAnimating
  r.minScreenSize = 0
  r.minScreenSizeForText = 0
  r.minScreenSizeForEffects = 0
  r._isViewportAnimating = false
  // Use scene content bounds for culling instead of the full 2e9x2e9 space.
  // This avoids recording off-screen nodes during export/thumbnail rendering.
  try {
    const pageNode = graph.getNode(pageId)
    if (pageNode && pageNode.childIds.length > 0) {
      const sceneNodes = pageNode.childIds
        .map((childId) => graph.getNode(childId))
        .filter((node): node is SceneNode => node != null)
      const bounds =
        sceneNodes.length > 0
          ? computeContentBounds(
              graph,
              sceneNodes.map((n) => n.id)
            )
          : null
      if (bounds) {
        const padding = 1024
        r.worldViewport = {
          x: bounds.minX - padding,
          y: bounds.minY - padding,
          w: bounds.maxX - bounds.minX + padding * 2,
          h: bounds.maxY - bounds.minY + padding * 2
        }
      } else {
        r.worldViewport = { x: -1e4, y: -1e4, w: 2e4, h: 2e4 }
      }
    } else {
      r.worldViewport = { x: -1e4, y: -1e4, w: 2e4, h: 2e4 }
    }
    if (pageNode) {
      for (const childId of pageNode.childIds) {
        r.renderNode(canvas, graph, childId, {})
      }
    }
  } finally {
    r.worldViewport = prevViewport
    r.minScreenSize = prevMinScreenSize
    r.minScreenSizeForText = prevMinScreenSizeForText
    r.minScreenSizeForEffects = prevMinScreenSizeForEffects
    r._isViewportAnimating = prevViewportAnimating
  }
}

export type RenderLayer = 'full' | 'scene' | 'overlays'

const LIVE_SCENE_CHANGE_MS = 120
const now = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now()

export function renderFromEditorState(
  r: SkiaRenderer,
  state: EditorState,
  graph: SceneGraph,
  textEditor: unknown,
  viewportWidth: number,
  viewportHeight: number,
  showRulers = true,
  dpr = 1,
  layer: RenderLayer = 'full'
): void {
  // ── Adaptive LOD: detect pan/zoom changes ──
  // Only the editor-state entry point can detect true user-initiated changes
  // (the raw render() path is called internally with unchanging viewport).
  detectViewportAnimation(r, state.panX, state.panY, state.zoom)

  r.dpr = dpr
  r.panX = state.panX
  r.panY = state.panY
  r.zoom = state.zoom
  r.viewportWidth = viewportWidth
  r.viewportHeight = viewportHeight
  r.showRulers = showRulers
  r.pageColor = state.pageColor
  r.rulerTheme = state.rulerTheme ?? null
  r.pageId = state.currentPageId
  render(
    r,
    graph,
    state.selectedIds,
    {
      hoveredNodeId: state.hoveredNodeId,
      enteredContainerId: state.enteredContainerId,
      editingTextId: state.editingTextId,
      textEditor: textEditor as RenderOverlays['textEditor'],
      marquee: state.marquee,
      snapGuides: state.snapGuides,
      rotationPreview: state.rotationPreview,
      dropTargetId: state.dropTargetId,
      layoutInsertIndicator: state.layoutInsertIndicator,
      penState: state.penState
        ? ({
            ...state.penState,
            cursorX: state.penCursorX ?? undefined,
            cursorY: state.penCursorY ?? undefined
          } as RenderOverlays['penState'])
        : null,
      nodeEditState: state.nodeEditState ?? null,
      remoteCursors: state.remoteCursors,
      autoLayoutHover: state.autoLayoutHover
    },
    state.sceneVersion,
    layer
  )
}

/**
 * Detect viewport position changes for adaptive LOD.
 * Sets _isViewportAnimating = true when panX, panY, or zoom changes
 * by more than a small epsilon (allows floating-point drift < 0.001).
 * Records the timestamp of the change in _animationStopTime.
 */
function detectViewportAnimation(r: SkiaRenderer, panX: number, panY: number, zoom: number): void {
  if (r._prevPanX == null || r._prevPanY == null || r._prevZoom == null) {
    r._prevPanX = panX
    r._prevPanY = panY
    r._prevZoom = zoom
    return
  }

  const prevX = r._prevPanX
  const prevY = r._prevPanY
  const prevZ = r._prevZoom

  // Allow floating-point drift at very high precision (< 0.001)
  const changed =
    Math.abs(panX - prevX) > 0.001 ||
    Math.abs(panY - prevY) > 0.001 ||
    Math.abs(zoom - prevZ) > 0.001

  r._prevPanX = panX
  r._prevPanY = panY
  r._prevZoom = zoom

  if (changed) {
    r._isViewportAnimating = true
    r._animationStopTime = now()
  }
}

function hasVolatileOverlay(overlays: RenderOverlays): boolean {
  return (
    overlays.dropTargetId != null ||
    overlays.rotationPreview != null ||
    overlays.editingTextId != null ||
    overlays.nodeEditState != null
  )
}

function hasLiveSceneChange(r: SkiaRenderer, sceneVersion: number, layer: RenderLayer): boolean {
  if (layer === 'overlays' || sceneVersion < 0 || sceneVersion === r.lastObservedSceneVersion) {
    return false
  }

  const timestamp = now()
  const live =
    r.lastSceneVersionChangeAt > 0 && timestamp - r.lastSceneVersionChangeAt < LIVE_SCENE_CHANGE_MS
  r.lastObservedSceneVersion = sceneVersion
  r.lastSceneVersionChangeAt = timestamp
  return live
}

function scenePictureMissReason(
  r: SkiaRenderer,
  graph: SceneGraph,
  overlays: RenderOverlays,
  sceneVersion: number,
  hasPositionPreview: boolean
): string {
  if (hasPositionPreview) return 'position-preview'
  if (hasVolatileOverlay(overlays)) return 'volatile-overlay'
  if (!r.scenePicture) return 'missing-picture'
  if (graph.positionPreviewVersion !== r.scenePicturePositionPreviewVersion)
    return 'position-preview-version'
  if (sceneVersion !== r.scenePictureVersion) return 'scene-version'
  if (r.pageId !== r.scenePicturePageId) return 'page'
  return 'unknown'
}

function canUseScenePicture(
  r: SkiaRenderer,
  graph: SceneGraph,
  sceneVersion: number,
  hasVolatileOverlays: boolean
): boolean {
  return (
    !hasVolatileOverlays &&
    !!r.scenePicture &&
    graph.positionPreviewVersion === r.scenePicturePositionPreviewVersion &&
    sceneVersion === r.scenePictureVersion &&
    r.pageId === r.scenePicturePageId
  )
}

function measure<T>(fn: () => T): { value: T; duration: number } {
  const start = now()
  const value = fn()
  return { value, duration: now() - start }
}

/**
 * Invalidate renderer caches when the scene or page changes.
 *
 * 1. Clear absPosFullCache when sceneVersion or pageId changes so absolute
 *    positions are recomputed with the correct scene state.
 * 2. Clear shaderCache on page change to prevent stale gradient shaders from
 *    a previous page occupying LRU capacity.
 */
function invalidateCachesOnChange(r: SkiaRenderer, sceneVersion: number): void {
  if (sceneVersion < 0) {
    r._absPosFullCache.clear()
    r._absPosFullSceneVersion = -1
    r._absPosFullPageId = r.pageId
  } else if (sceneVersion !== r._absPosFullSceneVersion || r.pageId !== r._absPosFullPageId) {
    r._absPosFullCache.clear()
    r._absPosFullSceneVersion = sceneVersion
    r._absPosFullPageId = r.pageId
  }

  if (r.pageId !== r._cachedLargeGraphPageId && r._cachedLargeGraphPageId != null) {
    r.fillPaint.setShader(null)
    r.shaderCache.clear()
  }
}

/**
 * Restore full detail when the viewport has been idle long enough,
 * and invalidate the scene picture cache if the animation state
 * has changed since the picture was recorded.
 */
function applyAdaptiveLodState(r: SkiaRenderer): void {
  if (r._isViewportAnimating && r._animationStopTime > 0) {
    const elapsed = now() - r._animationStopTime
    if (elapsed >= r._adaptiveLodRestoreMs) {
      r._isViewportAnimating = false
    }
  }

  if (r._isViewportAnimating !== r._scenePictureAnimating) {
    r.invalidateScenePicture()
  }
}

/**
 * Render the scene content (after canvas is already in scene coordinates).
 * Caller must do canvas.save/scale(r.dpr)/translate(panX)/scale(zoom) before
 * calling this and canvas.restore() after. The 'render:scene' phase is
 * managed by the caller — this function only manages inner phases.
 *
 * Extracted from render() to keep complexity under the lint limit.
 */
function renderSceneContent(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  overlays: RenderOverlays,
  sceneVersion: number,
  canUsePicture: boolean,
  isLargeGraph: boolean,
  hasVolatileOverlays: boolean,
  cacheMissReason: string
): void {
  const p = r.profiler

  if (canUsePicture) {
    p.setScenePictureMode('hit')
    p.beginPhase('render:drawPicture')
    if (r.scenePicture) {
      const picture = r.scenePicture
      const { duration } = measure(() => canvas.drawPicture(picture))
      p.setScenePictureDrawTime(duration)
    }
    p.endPhase('render:drawPicture')
  } else if (isLargeGraph || hasVolatileOverlays) {
    // Free retained WASM allocations when bypassing the cached pipelines
    // for large graphs — the existing scenePicture and sceneBacking were
    // created when the graph was small and would leak otherwise.
    if (isLargeGraph && (r.scenePicture || r.sceneBacking)) {
      r.invalidateScenePicture()
    }
    p.setScenePictureMode('volatile', cacheMissReason)
    r._nodeCount = 0
    r._culledCount = 0
    r._lodCulledCount = 0
    r._textLodCulledCount = 0
    r._effectLodCulledCount = 0
    p.beginPhase('render:direct')
    renderPageChildren(r, canvas, graph, overlays)
    p.endPhase('render:direct')
  } else {
    p.setScenePictureMode('record', cacheMissReason)
    r._nodeCount = 0
    r._culledCount = 0
    r._lodCulledCount = 0
    r._textLodCulledCount = 0
    r._effectLodCulledCount = 0
    p.beginPhase('render:recordPicture')
    const { duration } = measure(() => recordScenePicture(r, canvas, graph, sceneVersion))
    p.setScenePictureRecordTime(duration)
    p.endPhase('render:recordPicture')
  }
}

export function render(
  r: SkiaRenderer,
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays: RenderOverlays = {},
  sceneVersion = -1,
  layer: RenderLayer = 'full'
): void {
  applyAdaptiveLodState(r)

  const p = r.profiler
  p.beginFrame()
  p.setScenePictureDrawTime(0)
  p.setScenePictureRecordTime(0)
  p.setFlushTime(0)

  invalidateCachesOnChange(r, sceneVersion)

  const canvas = r.surface.getCanvas()
  if (layer === 'overlays') {
    canvas.clear(r.ck.Color4f(0, 0, 0, 0))
  } else {
    canvas.clear(r.ck.Color4f(r.pageColor.r, r.pageColor.g, r.pageColor.b, 1))
  }

  r.worldViewport = {
    x: -r.panX / r.zoom,
    y: -r.panY / r.zoom,
    w: r.viewportWidth / r.zoom,
    h: r.viewportHeight / r.zoom
  }
  updateSceneBackingPreviewState(r, layer)

  const hasPositionPreview =
    graph.positionPreviewVersion !== r.scenePicturePositionPreviewVersion &&
    sceneVersion === r.scenePictureVersion
  const hasVolatileOverlays =
    hasPositionPreview || hasVolatileOverlay(overlays) || hasLiveSceneChange(r, sceneVersion, layer)

  const isLargeGraph = computeIsLargeGraph(r, graph, sceneVersion)

  const canUsePicture =
    !isLargeGraph && canUseScenePicture(r, graph, sceneVersion, hasVolatileOverlays)
  const cacheMissReason = scenePictureMissReason(
    r,
    graph,
    overlays,
    sceneVersion,
    hasPositionPreview
  )

  p.setCacheHit(!!canUsePicture)

  if (layer !== 'overlays') {
    canvas.save()
    canvas.scale(r.dpr, r.dpr)

    p.beginPhase('render:scene')
    if (
      layer === 'scene' &&
      !isLargeGraph &&
      !hasVolatileOverlays &&
      renderSceneBacking(r, canvas, graph, sceneVersion)
    ) {
      p.setScenePictureMode('hit', 'backing')
    } else {
      canvas.translate(r.panX, r.panY)
      canvas.scale(r.zoom, r.zoom)
      renderSceneContent(
        r,
        canvas,
        graph,
        overlays,
        sceneVersion,
        canUsePicture,
        isLargeGraph,
        hasVolatileOverlays,
        cacheMissReason
      )
    }
    p.endPhase('render:scene')

    canvas.restore()
  }

  if (layer !== 'scene') {
    canvas.save()
    canvas.scale(r.dpr, r.dpr)
    r.labelCache.update(graph, r.pageId, sceneVersion, graph.positionPreviewVersion)
    p.beginPhase('render:sectionTitles')
    r.drawSectionTitles(canvas, graph)
    p.endPhase('render:sectionTitles')
    p.beginPhase('render:componentLabels')
    r.drawComponentLabels(canvas, graph)
    p.endPhase('render:componentLabels')
    canvas.restore()

    canvas.save()
    canvas.scale(r.dpr, r.dpr)

    r.drawHoverHighlight(
      canvas,
      graph,
      overlays.hoveredNodeId === overlays.nodeEditState?.nodeId ? null : overlays.hoveredNodeId
    )
    r.drawEnteredContainer(canvas, graph, overlays.enteredContainerId)
    p.beginPhase('render:selection')
    r.drawSelection(canvas, graph, selectedIds, overlays)
    p.endPhase('render:selection')
    r.drawFlashes(canvas, graph)
    r.drawSnapGuides(canvas, overlays.snapGuides)
    r.drawMarquee(canvas, overlays.marquee)
    r.drawLayoutInsertIndicator(canvas, overlays.layoutInsertIndicator)
    r.drawAutoLayoutHover(canvas, graph, overlays.autoLayoutHover)
    r.drawNodeEditOverlay(canvas, graph, overlays.nodeEditState)
    r.drawPenOverlay(canvas, overlays.penState)
    r.drawRemoteCursors(canvas, graph, overlays.remoteCursors)
    p.beginPhase('render:rulers')
    if (r.showRulers) r.drawRulers(canvas, graph, selectedIds)
    p.endPhase('render:rulers')

    p.drawHUD(canvas, r.showRulers)

    canvas.restore()
  }

  p.beginPhase('render:flush')
  const { duration: flushDuration } = measure(() => r.surface.flush())
  p.setFlushTime(flushDuration)
  p.endPhase('render:flush')

  p.setNodeCounts(r._nodeCount, r._culledCount)
  p.endFrame()
}

function renderPageChildren(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  overlays: RenderOverlays
): void {
  const pageNode = graph.getNode(r.pageId ?? graph.rootId)
  if (!pageNode) return
  for (const childId of pageNode.childIds) {
    r.renderNode(canvas, graph, childId, overlays)
  }
}

function recordScenePicture(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  sceneVersion: number
): void {
  r.scenePicture?.delete()
  const prevViewport = r.worldViewport
  r.worldViewport = { x: -1e6, y: -1e6, w: 2e6, h: 2e6 }
  const recorder = new r.ck.PictureRecorder()
  const pageNode = graph.getNode(r.pageId ?? graph.rootId)
  const sceneContentBounds = pageNode ? computeContentBounds(graph, pageNode.childIds) : null
  const sceneBounds = sceneContentBounds
    ? {
        x: sceneContentBounds.minX,
        y: sceneContentBounds.minY,
        width: sceneContentBounds.maxX - sceneContentBounds.minX,
        height: sceneContentBounds.maxY - sceneContentBounds.minY
      }
    : { x: 0, y: 0, width: 1, height: 1 }
  const padding = 1024
  const bounds = r.ck.LTRBRect(
    sceneBounds.x - padding,
    sceneBounds.y - padding,
    sceneBounds.x + sceneBounds.width + padding,
    sceneBounds.y + sceneBounds.height + padding
  )
  const recCanvas = recorder.beginRecording(bounds)
  if (pageNode) {
    for (const childId of pageNode.childIds) {
      r.renderNode(recCanvas, graph, childId, {})
    }
  }
  r.scenePicture = recorder.finishRecordingAsPicture()
  recorder.delete()
  r.worldViewport = prevViewport
  r.scenePictureVersion = sceneVersion
  r.scenePicturePositionPreviewVersion = graph.positionPreviewVersion
  r.scenePicturePageId = r.pageId
  r._scenePictureAnimating = r._isViewportAnimating
  canvas.drawPicture(r.scenePicture)
}

/**
 * Determine whether the current scene graph is large enough to bypass
 * the SkPicture cache and render directly with viewport culling.
 * Result is cached per sceneVersion to avoid O(n) recomputation every frame.
 */
function computeIsLargeGraph(r: SkiaRenderer, graph: SceneGraph, sceneVersion: number): boolean {
  if (
    sceneVersion >= 0 &&
    sceneVersion === r._cachedLargeGraphVersion &&
    r.pageId === r._cachedLargeGraphPageId
  ) {
    return r._cachedLargeGraphResult
  }
  const result =
    r.pageId != null
      ? graph.countDescendants(r.pageId) > DIRECT_RENDER_NODE_THRESHOLD
      : graph.nodes.size > DIRECT_RENDER_NODE_THRESHOLD
  r._cachedLargeGraphVersion = sceneVersion
  r._cachedLargeGraphPageId = r.pageId
  r._cachedLargeGraphResult = result
  return result
}
