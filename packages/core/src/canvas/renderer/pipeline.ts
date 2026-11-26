import type { Canvas } from '@open-pencil/canvaskit'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'

import { needsImagePreviews } from '#core/canvas/images/previews'
import { paintPageBackground } from '#core/canvas/page/background'
import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer/skia'
import { warmUpEffectPrograms } from '#core/canvas/warm-up'
import { playIslandRoots } from '#core/editor/play/islands'
import type { EditorState } from '#core/editor/types'
import { resolveEditorProfile } from '#core/editor/views/profile'
import { stagedSlide } from '#core/editor/views/stage'
import type { EditorProfile } from '#core/editor/views/types'
import { worldRectToScreen } from '#core/geometry'
import { emitNavigationTrace } from '#core/profiler'

import { documentSurfaceFor, presentDocumentSurface } from './document-surface'
import { drawChromePass, drawLabelPass, drawOverlayPass } from './overlay-pass'
import { hasTransientPreviews, renderPageWithPreviews } from './transient-previews'
import { computeContentBounds } from './visual-bounds'

/**
 * Runs `fn` as an export or thumbnail sees the document: saved glyphs included, whatever is being
 * edited. Its bounds and its drawing both take the text as it is saved, so neither crops the other;
 * the edited text's picture is of its live layout, so it is dropped on the way in and out.
 */
export function withoutTextEdit<T>(
  r: Pick<SkiaRenderer, 'editingTextId' | 'invalidateNodePicture'>,
  fn: () => T
): T {
  const editing = r.editingTextId
  if (!editing) return fn()
  r.editingTextId = null
  r.invalidateNodePicture(editing)
  try {
    return fn()
  } finally {
    r.editingTextId = editing
    r.invalidateNodePicture(editing)
  }
}

export function renderSceneToCanvas(
  r: Pick<
    SkiaRenderer,
    | 'worldViewport'
    | 'viewportImageRendering'
    | 'renderNode'
    | 'nodePaths'
    | 'editingTextId'
    | 'invalidateNodePicture'
    | 'documentColorSpace'
    | 'useDocumentColorSpace'
  >,
  canvas: Canvas,
  graph: SceneGraph,
  pageId: string
): void {
  r.nodePaths.releaseUncached()
  const prevViewport = r.worldViewport
  const previewMode = r.viewportImageRendering
  const colorSpace = r.documentColorSpace
  r.useDocumentColorSpace(graph.documentColorSpace)
  r.viewportImageRendering = false
  r.worldViewport = { x: -1e9, y: -1e9, w: 2e9, h: 2e9 }
  try {
    withoutTextEdit(r, () => {
      const pageNode = graph.getNode(pageId)
      if (pageNode) {
        for (const childId of pageNode.childIds) r.renderNode(canvas, graph, childId, {})
      }
    })
  } finally {
    r.worldViewport = prevViewport
    r.viewportImageRendering = previewMode
    r.useDocumentColorSpace(colorSpace)
  }
}

export type RenderLayer = 'full' | 'scene' | 'overlays'

/** Whether the pixel grid shows: on an edited canvas whose profile has one, unless turned off. */
function showsPixelGrid(profile: EditorProfile, state: EditorState): boolean {
  return profile.editChrome && profile.pixelGrid && state.showPixelGrid !== false
}

export function renderFromEditorState(
  r: SkiaRenderer,
  state: EditorState,
  graph: SceneGraph,
  textEditor: unknown,
  viewportWidth: number,
  viewportHeight: number,
  showRulers = true,
  dpr = 1,
  layer: RenderLayer = 'full',
  interactive = false
): void {
  r.useDocumentColorSpace(graph.documentColorSpace)
  r.recordPicturesIn(graph.documentColorSpace)
  const previewMode = r.images.previews.enabled && needsImagePreviews(graph)
  if (
    r.images.memoryGraph !== graph ||
    r.viewportImageRendering !== previewMode ||
    (previewMode && r.images.memoryPage !== state.currentPageId)
  ) {
    r.invalidateAllPictures()
    r.images.cache.clear()
    // Previews of another document hold its encoded images, which a document without
    // previews would otherwise keep alive.
    if (r.images.memoryGraph !== graph) {
      r.images.previews.release()
      r.images.fillUsers.clear()
    }
    r.images.memoryGraph = graph
    r.images.memoryPage = state.currentPageId
  }
  r.viewportImageRendering = previewMode
  r.dpr = dpr
  r.panX = state.panX
  r.panY = state.panY
  r.zoom = state.zoom
  r.viewportWidth = viewportWidth
  r.viewportHeight = viewportHeight
  r.showRulers = showRulers
  r.pageColor = state.pageColor
  r.setRulerTheme(state.rulerTheme ?? null)
  r.setSelectionTheme(state.selectionTheme)
  r.pageId = state.currentPageId
  stageSlide(r, state, graph)
  r.navigationPhase = state.navigation.phase
  r.navigationGeneration = state.navigation.generation
  const profile = resolveEditorProfile(state)
  const { editChrome, live, edits } = profile
  r.pageDotGrid = profile.dotGrid
  r.sectionTitles = profile.sectionTitles
  r.editHandles = edits && profile.layerEdits === 'all'
  render(
    r,
    graph,
    editChrome ? state.selectedIds : new Set<string>(),
    {
      playing: !editChrome,
      playIslands: live ? new Set(playIslandRoots(graph, state.currentPageId)) : undefined,
      hoveredNodeId: editChrome ? state.hoveredNodeId : null,
      showPixelGrid: showsPixelGrid(profile, state),
      showSizeLabels: state.showSizeLabels,
      gradientEdit: state.gradientEdit,
      blurRampEdit: state.blurRampEdit,
      transforming: state.transforming,
      measurementMode: state.measurementMode,
      editingTextId: state.editingTextId,
      renamingLabelId: state.renamingLabelId,
      textEditor: textEditor as RenderOverlays['textEditor'],
      marquee: state.marquee,
      snapGuides: state.snapGuides,
      guides: state.guides,
      rotationPreview: state.rotationPreview,
      dropTargetId: state.dropTargetId,
      layoutInsertIndicator: state.layoutInsertIndicator,
      penState: state.penState
        ? {
            ...state.penState,
            cursorX: state.penCursorX ?? undefined,
            cursorY: state.penCursorY ?? undefined
          }
        : null,
      pencilState: state.pencilState,
      nodeEditState: state.nodeEditState ?? null,
      presenceCursors: state.presenceCursors,
      designIssues: state.designIssues,
      codeFocusNodeId: state.codeFocusNodeId,
      scaleTool: state.activeTool === 'SCALE',
      autoLayoutHover: state.autoLayoutHover,
      shapeHandleHover: state.shapeHandleHover,
      connectorTarget: state.connectorTarget
    },
    // Recorded pictures follow what the canvas draws, not every document change.
    state.canvasVersion,
    layer,
    interactive
  )
  warmUpEffectPrograms(r, graph, layer, state.sceneVersion, interactive)
}

function sceneContentDependsOnOverlay(overlays: RenderOverlays): boolean {
  return (
    overlays.rotationPreview != null || overlays.nodeEditState != null || overlays.playing === true
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
  if (hasTransientPreviews(r, graph)) return 'transient-preview'
  if (sceneContentDependsOnOverlay(overlays)) return 'volatile-overlay'
  if (!r.wholeScene.picture) return 'missing-picture'
  if (graph.positionPreviewVersion !== r.wholeScene.positionPreviewVersion)
    return 'position-preview-version'
  if (sceneVersion !== r.wholeScene.version) return 'scene-version'
  if (r.fontGeneration !== r.wholeScene.fontGeneration) return 'font-generation'
  if (r.pageId !== r.wholeScene.pageId) return 'page'
  return 'unknown'
}

function canUseScenePicture(
  r: SkiaRenderer,
  graph: SceneGraph,
  sceneVersion: number,
  requiresUncachedSceneRender: boolean
): boolean {
  return (
    !requiresUncachedSceneRender &&
    !!r.wholeScene.picture &&
    graph.positionPreviewVersion === r.wholeScene.positionPreviewVersion &&
    sceneVersion === r.wholeScene.version &&
    r.fontGeneration === r.wholeScene.fontGeneration &&
    r.pageId === r.wholeScene.pageId
  )
}

function getSceneRenderPolicy(
  r: SkiaRenderer,
  graph: SceneGraph,
  overlays: RenderOverlays,
  sceneVersion: number,
  layer: RenderLayer,
  interactive: boolean
) {
  const hasPositionPreview =
    graph.positionPreviewVersion !== r.wholeScene.positionPreviewVersion &&
    sceneVersion === r.wholeScene.version
  // Image previews arrive over time; the uncached path redraws everything to show each one, the
  // tiled path redraws only the nodes that drew the image (flushDecodedPreviews).
  const tilesHoldPreviews = layer === 'scene'
  const requiresUncachedSceneRender =
    (r.viewportImageRendering && !tilesHoldPreviews) ||
    interactive ||
    hasPositionPreview ||
    sceneContentDependsOnOverlay(overlays) ||
    hasTransientPreviews(r, graph)
  return {
    requiresUncachedSceneRender,
    canUsePicture: canUseScenePicture(r, graph, sceneVersion, requiresUncachedSceneRender),
    cacheMissReason: interactive
      ? 'active-edit'
      : scenePictureMissReason(r, graph, overlays, sceneVersion, hasPositionPreview)
  }
}

const now = typeof performance !== 'undefined' ? () => performance.now() : () => 0

function measure<T>(fn: () => T): { value: T; duration: number } {
  const start = now()
  const value = fn()
  return { value, duration: now() - start }
}

/** Labels, editing overlays, and rulers; a previewing canvas keeps only the rulers' chrome pass. */
function drawAboveScene(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays: RenderOverlays,
  sceneVersion: number
): void {
  canvas.save()
  canvas.scale(r.dpr, r.dpr)
  clipToStage(r, canvas, graph)
  r.labelCache.update(graph, r.pageId, sceneVersion, graph.positionPreviewVersion)
  r.statusLabels = []
  if (!overlays.playing) drawLabelPass(r, canvas, graph, selectedIds, overlays)
  canvas.restore()

  canvas.save()
  canvas.scale(r.dpr, r.dpr)
  if (!overlays.playing) drawOverlayPass(r, canvas, graph, selectedIds, overlays, sceneVersion)
  drawChromePass(r, canvas, graph, selectedIds, overlays)
  canvas.restore()
}

export function render(
  r: SkiaRenderer,
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays: RenderOverlays = {},
  sceneVersion = -1,
  layer: RenderLayer = 'full',
  interactive = false
): void {
  // Every entry point draws in the profile of the graph it is given.
  r.useDocumentColorSpace(graph.documentColorSpace)
  r.recordPicturesIn(graph.documentColorSpace)
  r.editingTextId = overlays.editingTextId ?? null
  emitNavigationTrace('render:start', {
    layer,
    sceneVersion,
    panX: r.panX,
    panY: r.panY,
    zoom: r.zoom
  })
  r.syncFontGeneration()
  r.flushDecodedPreviews(graph)
  r.nodePaths.releaseUncached()
  r.frameGeometry = null
  const p = r.profiler
  p.beginFrame()
  p.setScenePictureDrawTime(0)
  p.setScenePictureRecordTime(0)
  p.setFlushTime(0)

  graph.clearAbsPosCache()

  const canvas = r.surface.getCanvas()
  // The scene draws in the document's color space, on the screen or on a surface shown on it.
  const documentSurface = layer === 'overlays' ? null : documentSurfaceFor(r)
  const sceneCanvas = documentSurface?.getCanvas() ?? canvas
  if (layer === 'overlays') {
    canvas.clear(r.ck.Color4f(0, 0, 0, 0))
  } else {
    paintPageBackground(r, sceneCanvas, { x: r.panX * r.dpr, y: r.panY * r.dpr }, r.zoom * r.dpr)
  }

  r.worldViewport = {
    x: -r.panX / r.zoom,
    y: -r.panY / r.zoom,
    w: r.viewportWidth / r.zoom,
    h: r.viewportHeight / r.zoom
  }
  r.images.detailScale = r.zoom * r.dpr

  const { requiresUncachedSceneRender, canUsePicture, cacheMissReason } = getSceneRenderPolicy(
    r,
    graph,
    overlays,
    sceneVersion,
    layer,
    interactive
  )

  if (layer !== 'overlays') {
    // Drawn directly, the whole scene is on screen this frame.
    if (requiresUncachedSceneRender) {
      r.tiledScenePending = false
      r.tiledSceneCovered = true
    }
    sceneCanvas.save()
    sceneCanvas.scale(r.dpr, r.dpr)
    clipToStage(r, sceneCanvas, graph)

    p.beginPhase('render:scene')
    if (layer === 'scene' && !requiresUncachedSceneRender) {
      // The scene layer is tiles, idle or moving; the whole-scene picture serves one canvas.
      const tiled = r.tiledScene.renderFrame(
        r,
        sceneCanvas,
        graph,
        sceneVersion,
        r.navigationGeneration
      )
      r.tiledScenePending = tiled.pending
      r.tiledSceneBackgroundPending = tiled.backgroundPending
      r.tiledSceneCovered = tiled.covered
      p.setScenePictureMode('hit', tiled.covered ? 'tiled' : 'tiled-fallback')
    } else {
      sceneCanvas.translate(r.panX, r.panY)
      sceneCanvas.scale(r.zoom, r.zoom)
      renderSceneContent(
        r,
        sceneCanvas,
        graph,
        overlays,
        sceneVersion,
        canUsePicture,
        cacheMissReason,
        requiresUncachedSceneRender
      )
    }
    p.endPhase('render:scene')

    sceneCanvas.restore()
    if (documentSurface) presentDocumentSurface(canvas, documentSurface)
  }

  if (layer !== 'scene') drawAboveScene(r, canvas, graph, selectedIds, overlays, sceneVersion)

  p.beginPhase('render:flush')
  const { duration: flushDuration } = measure(() => r.surface.flush())
  p.setFlushTime(flushDuration)
  p.endPhase('render:flush')

  p.setNodeCounts(r.drawCounts.nodes, r.drawCounts.culled)
  p.endFrame()
  emitNavigationTrace('render:end', {
    layer,
    sceneVersion,
    panX: r.panX,
    panY: r.panY,
    zoom: r.zoom,
    flushMs: flushDuration,
    nodes: r.drawCounts.nodes,
    culledNodes: r.drawCounts.culled
  })
}

/** Takes the slide on the stage for the frame about to be drawn. */
function stageSlide(r: SkiaRenderer, state: EditorState, graph: SceneGraph): void {
  r.stagedSlideId = stagedSlide(graph, state)?.id ?? null
}

/** Leaves only the slide on the stage, if there is one, to what is drawn next. */
function clipToStage(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph): void {
  const slide = r.stagedSlideId ? graph.getNode(r.stagedSlideId) : undefined
  if (!slide) return
  const { x, y, width, height } = worldRectToScreen(r, getAxisAlignedWorldBounds(slide, graph))
  canvas.clipRect(r.ck.XYWHRect(x, y, width, height), r.ck.ClipOp.Intersect, true)
}

function renderSceneContent(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  overlays: RenderOverlays,
  sceneVersion: number,
  canUsePicture: boolean,
  cacheMissReason: string,
  requiresUncachedSceneRender: boolean
): void {
  const p = r.profiler
  if (canUsePicture) {
    p.setScenePictureMode('hit')
    p.beginPhase('render:drawPicture')
    if (r.wholeScene.picture) {
      const picture = r.wholeScene.picture
      const { duration } = measure(() => canvas.drawPicture(picture))
      p.setScenePictureDrawTime(duration)
    }
    p.endPhase('render:drawPicture')
  } else if (requiresUncachedSceneRender) {
    p.setScenePictureMode('volatile', cacheMissReason)
    r.drawCounts.nodes = 0
    r.drawCounts.culled = 0
    p.beginPhase('render:volatile')
    renderPageChildren(r, canvas, graph, overlays)
    p.endPhase('render:volatile')
  } else {
    p.setScenePictureMode('record', cacheMissReason)
    r.drawCounts.nodes = 0
    r.drawCounts.culled = 0
    p.beginPhase('render:recordPicture')
    const { duration } = measure(() => recordScenePicture(r, canvas, graph, sceneVersion))
    p.setScenePictureRecordTime(duration)
    p.endPhase('render:recordPicture')
  }
}

function renderPageChildren(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  overlays: RenderOverlays
): void {
  if (renderPageWithPreviews(r, canvas, graph, overlays)) return
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
  r.wholeScene.picture?.delete()
  r.wholeScene.picture = null
  const prevViewport = r.worldViewport
  r.worldViewport = { x: -1e6, y: -1e6, w: 2e6, h: 2e6 }
  const recorder = new r.ck.PictureRecorder()
  try {
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
    r.wholeScene.picture = recorder.finishRecordingAsPicture()
    r.wholeScene.version = sceneVersion
    r.wholeScene.fontGeneration = r.fontGeneration
    r.wholeScene.positionPreviewVersion = graph.positionPreviewVersion
    r.wholeScene.pageId = r.pageId
    canvas.drawPicture(r.wholeScene.picture)
  } finally {
    recorder.delete()
    r.worldViewport = prevViewport
  }
}
