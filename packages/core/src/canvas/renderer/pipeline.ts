import type { Canvas } from 'canvaskit-wasm'

import { drawPageGuides } from '#core/canvas/page-guides'
import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'
import type { EditorState } from '#core/editor/types'
import type { SceneGraph } from '#core/scene-graph'

import {
  cachedSubtreePicture,
  hasCachedSubtreePictureHit,
  renderSceneBacking,
  updateSceneBackingPreviewState
} from './retained-backing'

export function renderSceneToCanvas(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  pageId: string
): void {
  const prevViewport = r.worldViewport
  r.worldViewport = { x: -1e9, y: -1e9, w: 2e9, h: 2e9 }
  const pageNode = graph.getNode(pageId)
  if (pageNode) {
    for (const childId of pageNode.childIds) {
      r.renderNode(canvas, graph, childId, {})
    }
  }
  r.worldViewport = prevViewport
}

export type RenderLayer = 'full' | 'scene' | 'overlays'

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
      draggingClipBypassAll: state.draggingClipBypassAll,
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

function hasVolatileOverlay(overlays: RenderOverlays): boolean {
  return (
    overlays.dropTargetId != null ||
    Boolean(overlays.draggingClipBypassAll) ||
    overlays.rotationPreview != null ||
    overlays.editingTextId != null ||
    overlays.nodeEditState != null
  )
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
  if (r.scenePictureVersion < 0) return 'missing-picture'
  if (graph.positionPreviewVersion !== r.scenePicturePositionPreviewVersion)
    return 'position-preview-version'
  if (sceneVersion !== r.scenePictureVersion) return 'scene-version'
  if (r.pageId !== r.scenePicturePageId) return 'page'
  return 'unknown'
}

const now = typeof performance !== 'undefined' ? () => performance.now() : () => 0

function measure<T>(fn: () => T): { value: T; duration: number } {
  const start = now()
  const value = fn()
  return { value, duration: now() - start }
}

export function render(
  r: SkiaRenderer,
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays: RenderOverlays = {},
  sceneVersion = -1,
  layer: RenderLayer = 'full'
): void {
  const p = r.profiler
  p.beginFrame()
  p.setScenePictureDrawTime(0)
  p.setScenePictureRecordTime(0)
  p.setFlushTime(0)

  graph.clearAbsPosCache()

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
  const hasVolatileOverlays = hasPositionPreview || hasVolatileOverlay(overlays)

  const cacheMissReason = scenePictureMissReason(
    r,
    graph,
    overlays,
    sceneVersion,
    hasPositionPreview
  )

  if (layer !== 'overlays') {
    canvas.save()
    canvas.scale(r.dpr, r.dpr)

    p.beginPhase('render:scene')
    if (
      layer === 'scene' &&
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
        cacheMissReason,
        hasVolatileOverlays
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
    drawPageGuides(r, canvas, graph)
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

function renderSceneContent(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  overlays: RenderOverlays,
  sceneVersion: number,
  cacheMissReason: string,
  hasVolatileOverlays: boolean
): void {
  const p = r.profiler
  if (hasVolatileOverlays) {
    p.setScenePictureMode('volatile', cacheMissReason)
    r._nodeCount = 0
    r._culledCount = 0
    p.beginPhase('render:volatile')
    renderPageChildren(r, canvas, graph, overlays, sceneVersion)
    p.endPhase('render:volatile')
  } else {
    r._nodeCount = 0
    r._culledCount = 0
    const allHit = canDrawPageChildrenFromCache(r, graph, sceneVersion)
    const phase = allHit ? 'render:drawPicture' : 'render:recordPicture'
    p.setScenePictureMode(allHit ? 'hit' : 'record', allHit ? '' : cacheMissReason)
    p.beginPhase(phase)
    const { duration } = measure(() =>
      renderPageChildren(r, canvas, graph, overlays, sceneVersion)
    )
    if (allHit) p.setScenePictureDrawTime(duration)
    else p.setScenePictureRecordTime(duration)
    p.endPhase(phase)
    updateStableScenePictureState(r, graph, sceneVersion)
  }
}

function canDrawPageChildrenFromCache(
  r: SkiaRenderer,
  graph: SceneGraph,
  sceneVersion: number
): boolean {
  const pageNode = graph.getNode(r.pageId ?? graph.rootId)
  if (!pageNode) return true
  return pageNode.childIds.every((childId) =>
    hasCachedSubtreePictureHit(r, graph, childId, sceneVersion)
  )
}

function renderPageChildren(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  overlays: RenderOverlays,
  sceneVersion: number
): void {
  const pageNode = graph.getNode(r.pageId ?? graph.rootId)
  if (!pageNode) return
  for (const childId of pageNode.childIds) {
    const picture = cachedSubtreePicture(r, graph, childId, sceneVersion)
    if (picture) {
      canvas.drawPicture(picture)
    } else {
      r.renderNode(canvas, graph, childId, overlays)
    }
  }
}

function updateStableScenePictureState(
  r: SkiaRenderer,
  graph: SceneGraph,
  sceneVersion: number
): void {
  r.scenePictureVersion = sceneVersion
  r.scenePicturePositionPreviewVersion = graph.positionPreviewVersion
  r.scenePicturePageId = r.pageId
}
