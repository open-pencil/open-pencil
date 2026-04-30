import { computeDescendantVisualBounds } from '#core/geometry'

import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'
import type { EditorState } from '#core/editor/types'
import type { SceneGraph } from '#core/scene-graph'
import type { Canvas } from 'canvaskit-wasm'

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
  const extendedState = state as EditorState & {
    nodeEditState?: RenderOverlays['nodeEditState']
  }
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
      nodeEditState: extendedState.nodeEditState ?? null,
      remoteCursors: state.remoteCursors
    },
    state.sceneVersion,
    layer
  )
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

  const hasVolatileOverlays =
    hasVolatileOverlay(overlays) || hasLiveSceneChange(r, sceneVersion, layer)

  const canUsePicture =
    !hasVolatileOverlays &&
    r.scenePicture &&
    sceneVersion === r.scenePictureVersion &&
    r.pageId === r.scenePicturePageId

  p.setCacheHit(!!canUsePicture)

  if (layer !== 'overlays') {
    canvas.save()
    canvas.scale(r.dpr, r.dpr)
    canvas.translate(r.panX, r.panY)
    canvas.scale(r.zoom, r.zoom)

    p.beginPhase('render:scene')
    if (canUsePicture) {
      p.beginPhase('render:drawPicture')
      if (r.scenePicture) canvas.drawPicture(r.scenePicture)
      p.endPhase('render:drawPicture')
    } else if (hasVolatileOverlays) {
      r._nodeCount = 0
      r._culledCount = 0
      p.beginPhase('render:volatile')
      renderPageChildren(r, canvas, graph, overlays)
      p.endPhase('render:volatile')
    } else {
      r._nodeCount = 0
      r._culledCount = 0
      p.beginPhase('render:recordPicture')
      recordScenePicture(r, canvas, graph, sceneVersion)
      if (r.scenePicture) canvas.drawPicture(r.scenePicture)
      p.endPhase('render:recordPicture')
    }
    p.endPhase('render:scene')

    canvas.restore()
  }

  if (layer !== 'scene') {
    canvas.save()
    canvas.scale(r.dpr, r.dpr)
    r.labelCache.update(graph, r.pageId, sceneVersion)
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
  r.surface.flush()
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
  const sceneContentBounds = pageNode
    ? computeDescendantVisualBounds(
        pageNode.childIds,
        (id) => graph.getNode(id),
        (id) => graph.getAbsolutePosition(id)
      )
    : null
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
  r.scenePicturePageId = r.pageId
  canvas.drawPicture(r.scenePicture)
}
