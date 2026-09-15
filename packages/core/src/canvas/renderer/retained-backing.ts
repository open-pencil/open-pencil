/* eslint-disable max-lines -- retained backing allocation, coverage, and incremental construction share renderer state */
import type { Canvas, Image as CKImage, Surface } from 'canvaskit-wasm'

import { type SceneGraph } from '@open-pencil/scene-graph'
import {
  computeDescendantVisualBounds,
  unionVisualBounds,
  type VisualBounds
} from '@open-pencil/scene-graph/geometry'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { clearSubtreePictureCache } from '#core/canvas/renderer/state'
import { worldNodeVisualBounds } from '#core/canvas/renderer/visual-bounds'
import { emitNavigationTrace } from '#core/profiler'

import { clamp, smoothAverage } from './retained-backing/timing'
import type { SceneBackingGeometry } from './retained-backing/types'

export { updateSceneBackingPreviewState } from './retained-backing/preview'

const now = typeof performance !== 'undefined' ? () => performance.now() : () => 0
const SCENE_BACKING_SCALE = 3
const MAX_SCENE_BACKING_DEVICE_PIXELS = 16_000_000
const SCENE_BACKING_BUILD_BUDGET_MS = 6

function backingMetadataMatches(
  r: SkiaRenderer,
  sceneVersion: number,
  positionPreviewVersion: number
): boolean {
  const backing = r.sceneBacking
  return !!(
    backing &&
    backing.pageId === r.pageId &&
    backing.sceneVersion === sceneVersion &&
    backing.positionPreviewVersion === positionPreviewVersion &&
    backing.fontGeneration === r.fontGeneration
  )
}

function backingScreenCoverageContainsViewport(r: SkiaRenderer): boolean {
  const backing = r.sceneBacking
  if (!backing) return false
  const scale = r.zoom / backing.zoom
  const x = r.panX - backing.panX * scale
  const y = r.panY - backing.panY * scale
  return (
    x <= 0 &&
    y <= 0 &&
    x + backing.width * scale >= r.viewportWidth &&
    y + backing.height * scale >= r.viewportHeight
  )
}

function backingWorldCoverageContainsLiveViewport(r: SkiaRenderer): boolean {
  const backing = r.sceneBacking
  if (!backing) return false
  const liveX = -r.panX / r.zoom
  const liveY = -r.panY / r.zoom
  const liveW = r.viewportWidth / r.zoom
  const liveH = r.viewportHeight / r.zoom
  return (
    liveX >= backing.worldX &&
    liveY >= backing.worldY &&
    liveX + liveW <= backing.worldX + backing.worldWidth &&
    liveY + liveH <= backing.worldY + backing.worldHeight
  )
}

function backingPixelGridMatchesLiveViewport(r: SkiaRenderer): boolean {
  const backing = r.sceneBacking
  if (!backing || backing.dpr !== r.dpr || backing.zoom !== r.zoom) {
    return false
  }
  // Compare against the original viewport, not its rounded overscan origin.
  // A freshly built backing therefore always matches exactly (zero delta).
  const x = (r.panX - backing.anchorPanX) * r.dpr
  const y = (r.panY - backing.anchorPanY) * r.dpr
  return Number.isInteger(x) && Number.isInteger(y)
}

function backingCoverageContainsLiveViewport(
  r: SkiaRenderer,
  sceneVersion: number,
  allowStaleZoom: boolean,
  positionPreviewVersion: number
): boolean {
  if (!backingMetadataMatches(r, sceneVersion, positionPreviewVersion)) return false
  if (allowStaleZoom && backingScreenCoverageContainsViewport(r)) return true
  return backingPixelGridMatchesLiveViewport(r) && backingWorldCoverageContainsLiveViewport(r)
}

function drawSceneBacking(
  r: SkiaRenderer,
  canvas: Canvas,
  sceneVersion: number,
  allowStaleZoom: boolean,
  positionPreviewVersion: number
): boolean {
  const backing = r.sceneBacking
  if (
    !backing ||
    !backingCoverageContainsLiveViewport(r, sceneVersion, allowStaleZoom, positionPreviewVersion)
  ) {
    return false
  }

  const pixelAligned = backingPixelGridMatchesLiveViewport(r)
  const scale = r.zoom / backing.zoom
  const x = pixelAligned
    ? ((r.panX - backing.anchorPanX) * r.dpr - backing.marginDeviceX) / r.dpr
    : r.panX - backing.panX * scale
  const y = pixelAligned
    ? ((r.panY - backing.anchorPanY) * r.dpr - backing.marginDeviceY) / r.dpr
    : r.panY - backing.panY * scale
  r.opacityPaint.setAlphaf(1)
  canvas.drawImageRectOptions(
    backing.image,
    r.ck.LTRBRect(0, 0, backing.width * backing.dpr, backing.height * backing.dpr),
    r.ck.LTRBRect(x, y, x + backing.width * scale, y + backing.height * scale),
    pixelAligned ? r.ck.FilterMode.Nearest : r.ck.FilterMode.Linear,
    r.ck.MipmapMode.None,
    r.opacityPaint
  )
  return true
}

function sceneBackingScale(r: SkiaRenderer): number {
  const viewportDevicePixels = r.viewportWidth * r.viewportHeight * r.dpr * r.dpr
  if (viewportDevicePixels <= 0) return 1
  return clamp(
    Math.sqrt(MAX_SCENE_BACKING_DEVICE_PIXELS / viewportDevicePixels),
    1,
    SCENE_BACKING_SCALE
  )
}

function sceneBackingGeometry(r: SkiaRenderer): SceneBackingGeometry {
  const backingScale = sceneBackingScale(r)
  // Keep the raster on the live viewport's device-pixel grid. Fractional
  // overscan offsets otherwise resample already antialiased edges on every blit.
  const marginDeviceX = Math.floor(r.viewportWidth * ((backingScale - 1) / 2) * r.dpr)
  const marginDeviceY = Math.floor(r.viewportHeight * ((backingScale - 1) / 2) * r.dpr)
  const marginX = marginDeviceX / r.dpr
  const marginY = marginDeviceY / r.dpr
  const width = Math.max(1, Math.ceil(r.viewportWidth + marginX * 2))
  const height = Math.max(1, Math.ceil(r.viewportHeight + marginY * 2))
  const backingPanX = r.panX + marginX
  const backingPanY = r.panY + marginY
  return {
    anchorPanX: r.panX,
    anchorPanY: r.panY,
    marginDeviceX,
    marginDeviceY,
    panX: backingPanX,
    panY: backingPanY,
    width,
    height,
    worldX: -backingPanX / r.zoom,
    worldY: -backingPanY / r.zoom,
    worldWidth: width / r.zoom,
    worldHeight: height / r.zoom,
    zoom: r.zoom,
    dpr: r.dpr
  }
}

function createSceneBackingSurface(r: SkiaRenderer, width: number, height: number): Surface | null {
  if (r.sceneBackingAllocationFailed) return null
  const info = {
    width: Math.ceil(width * r.dpr),
    height: Math.ceil(height * r.dpr),
    colorType: r.ck.ColorType.RGBA_8888,
    alphaType: r.ck.AlphaType.Premul,
    colorSpace: r.ck.ColorSpace.SRGB
  }
  try {
    return r.surface.makeSurface(info)
  } catch (error) {
    r.sceneBackingAllocationFailed = true
    console.warn(
      `Disabling retained scene backing after CanvasKit failed to allocate ${info.width}×${info.height}`,
      error
    )
    return null
  }
}

function ensureSubtreePictureCacheScope(
  r: SkiaRenderer,
  graph: SceneGraph,
  sceneVersion: number
): void {
  if (
    r.subtreePictureCachePageId === r.pageId &&
    r.subtreePictureCacheSceneVersion === sceneVersion &&
    r.subtreePictureCachePositionPreviewVersion === graph.positionPreviewVersion &&
    r.subtreePictureCacheFontGeneration === r.fontGeneration
  ) {
    return
  }
  clearSubtreePictureCache(r)
  r.subtreePictureCachePageId = r.pageId
  r.subtreePictureCacheSceneVersion = sceneVersion
  r.subtreePictureCachePositionPreviewVersion = graph.positionPreviewVersion
  r.subtreePictureCacheFontGeneration = r.fontGeneration
}

/**
 * Retained pictures are recorded in world coordinates, so their recording bounds must account for
 * the complete ancestor transform chain. The regular visual-bounds helper intentionally accepts
 * only an absolute origin and a node-local rotation; that is insufficient for descendants of
 * reflected or rotated instances and can clip otherwise valid draw commands from the picture.
 */
export function computeRetainedSubtreeBounds(
  graph: SceneGraph,
  childId: string
): VisualBounds | null {
  const visualBounds = computeDescendantVisualBounds(
    [childId],
    (id) => graph.getNode(id),
    (id) => graph.getAbsolutePosition(id)
  )
  let transformedBounds: VisualBounds | null = null
  const pending = [childId]

  while (pending.length > 0) {
    const nodeId = pending.pop()
    if (!nodeId) continue
    const node = graph.getNode(nodeId)
    if (!node?.visible) continue

    transformedBounds = unionVisualBounds(transformedBounds, worldNodeVisualBounds(graph, node))
    pending.push(...node.childIds)
  }

  return unionVisualBounds(visualBounds, transformedBounds)
}

function cachedSubtreePicture(
  r: SkiaRenderer,
  graph: SceneGraph,
  childId: string,
  sceneVersion: number
) {
  ensureSubtreePictureCacheScope(r, graph, sceneVersion)
  const cached = r.subtreePictureCache.get(childId)
  if (
    cached &&
    cached.pageId === r.pageId &&
    cached.sceneVersion === sceneVersion &&
    cached.positionPreviewVersion === graph.positionPreviewVersion &&
    cached.fontGeneration === r.fontGeneration
  ) {
    return cached.picture
  }

  cached?.picture.delete()
  r.subtreePictureCache.delete(childId)
  const bounds = computeRetainedSubtreeBounds(graph, childId)
  if (!bounds) return null

  const recorder = new r.ck.PictureRecorder()
  const prevViewport = r.worldViewport
  try {
    const recCanvas = recorder.beginRecording(
      r.ck.LTRBRect(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
    )
    r.worldViewport = {
      x: bounds.minX,
      y: bounds.minY,
      w: bounds.maxX - bounds.minX,
      h: bounds.maxY - bounds.minY
    }
    r.renderNode(recCanvas, graph, childId, {})
    const picture = recorder.finishRecordingAsPicture()
    r.subtreePictureCache.set(childId, {
      picture,
      pageId: r.pageId,
      sceneVersion,
      positionPreviewVersion: graph.positionPreviewVersion,
      fontGeneration: r.fontGeneration
    })
    return picture
  } finally {
    r.worldViewport = prevViewport
    recorder.delete()
  }
}

function drawRetainedChild(
  r: SkiaRenderer,
  graph: SceneGraph,
  canvas: Canvas,
  childId: string,
  sceneVersion: number,
  renderingSceneBacking: boolean
): void {
  const child = graph.getNode(childId)
  const hasCacheableEffects = child?.effects.some(
    (effect) => effect.visible && (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW')
  )
  if (hasCacheableEffects) {
    const previous = r.renderingSceneBacking
    r.renderingSceneBacking = renderingSceneBacking
    try {
      r.renderNode(canvas, graph, childId, {})
    } finally {
      r.renderingSceneBacking = previous
    }
  } else {
    const picture = cachedSubtreePicture(r, graph, childId, sceneVersion)
    if (picture) canvas.drawPicture(picture)
    else r.renderNode(canvas, graph, childId, {})
  }
}

function drawSettledScene(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  sceneVersion: number
): void {
  // Analytic AA depends on framebuffer dimensions as well as pixel/quad phase.
  // Reuse existing pictures at the live viewport origin and size. Overscan
  // remains available for navigation; this creates no additional cache.
  canvas.save()
  try {
    canvas.translate(r.panX, r.panY)
    canvas.scale(r.zoom, r.zoom)
    const page = graph.getNode(r.pageId ?? graph.rootId)
    for (const childId of page?.childIds ?? []) {
      drawRetainedChild(r, graph, canvas, childId, sceneVersion, false)
    }
  } finally {
    canvas.restore()
  }
}

function renderBackingChild(
  r: SkiaRenderer,
  graph: SceneGraph,
  surface: Surface,
  childId: string,
  backing: SceneBackingGeometry,
  sceneVersion: number
): void {
  const canvas = surface.getCanvas()
  const prevViewport = r.worldViewport
  r.worldViewport = {
    x: backing.worldX,
    y: backing.worldY,
    w: backing.worldWidth,
    h: backing.worldHeight
  }
  canvas.save()
  try {
    canvas.scale(r.dpr, r.dpr)
    canvas.translate(backing.panX, backing.panY)
    canvas.scale(r.zoom, r.zoom)
    drawRetainedChild(r, graph, canvas, childId, sceneVersion, true)
  } finally {
    canvas.restore()
    r.worldViewport = prevViewport
  }
}

function sceneBackingMetrics(backing: SceneBackingGeometry): SceneBackingGeometry {
  return {
    anchorPanX: backing.anchorPanX,
    anchorPanY: backing.anchorPanY,
    marginDeviceX: backing.marginDeviceX,
    marginDeviceY: backing.marginDeviceY,
    panX: backing.panX,
    panY: backing.panY,
    zoom: backing.zoom,
    width: backing.width,
    height: backing.height,
    dpr: backing.dpr,
    worldX: backing.worldX,
    worldY: backing.worldY,
    worldWidth: backing.worldWidth,
    worldHeight: backing.worldHeight
  }
}

function installSceneBackingImage(
  r: SkiaRenderer,
  image: CKImage,
  sceneVersion: number,
  positionPreviewVersion: number,
  backing: SceneBackingGeometry
): void {
  r.sceneBacking?.image.delete()
  r.sceneBacking = {
    image,
    pageId: r.pageId,
    sceneVersion,
    positionPreviewVersion,
    fontGeneration: r.fontGeneration,
    ...sceneBackingMetrics(backing)
  }
  // Advancing the preview baseline must not relabel an older whole-scene
  // picture as current: navigation can still fall back to that picture.
  if (
    r.scenePictureVersion !== sceneVersion ||
    r.scenePicturePositionPreviewVersion !== positionPreviewVersion ||
    r.scenePicturePageId !== r.pageId ||
    r.scenePictureFontGeneration !== r.fontGeneration
  ) {
    r.scenePicture?.delete()
    r.scenePicture = null
  }
  r.scenePictureVersion = sceneVersion
  r.scenePicturePositionPreviewVersion = positionPreviewVersion
  r.scenePicturePageId = r.pageId
  r.sceneBackingNeedsCrispRender = false
}

function cancelSceneBackingBuild(r: SkiaRenderer): void {
  r.sceneBackingBuild?.surface.delete()
  r.sceneBackingBuild = null
}

function sceneBackingBuildMatches(r: SkiaRenderer, sceneVersion: number): boolean {
  const build = r.sceneBackingBuild
  if (!build) return false
  const backing = sceneBackingGeometry(r)
  return (
    build.pageId === r.pageId &&
    build.sceneVersion === sceneVersion &&
    build.positionPreviewVersion === build.graph.positionPreviewVersion &&
    build.fontGeneration === r.fontGeneration &&
    build.anchorPanX === backing.anchorPanX &&
    build.anchorPanY === backing.anchorPanY &&
    build.width === backing.width &&
    build.height === backing.height &&
    build.panX === backing.panX &&
    build.panY === backing.panY &&
    build.zoom === backing.zoom &&
    build.dpr === backing.dpr
  )
}

function startSceneBackingBuild(r: SkiaRenderer, graph: SceneGraph, sceneVersion: number): void {
  cancelSceneBackingBuild(r)
  const backing = sceneBackingGeometry(r)
  const pageNode = graph.getNode(r.pageId ?? graph.rootId)
  const surface = createSceneBackingSurface(r, backing.width, backing.height)
  if (!surface) return
  surface.getCanvas().clear(r.ck.Color4f(r.pageColor.r, r.pageColor.g, r.pageColor.b, 1))
  r.sceneBackingBuild = {
    surface,
    graph,
    childIds: pageNode?.childIds ? [...pageNode.childIds] : [],
    index: 0,
    startedAt: now(),
    pageId: r.pageId,
    sceneVersion,
    positionPreviewVersion: graph.positionPreviewVersion,
    fontGeneration: r.fontGeneration,
    ...sceneBackingMetrics(backing)
  }
  emitNavigationTrace('backing:build', {
    phase: 'start',
    childCount: r.sceneBackingBuild.childIds.length,
    panX: backing.panX,
    panY: backing.panY,
    zoom: backing.zoom
  })
}

function stepSceneBackingBuild(r: SkiaRenderer, sceneVersion: number): boolean {
  const build = r.sceneBackingBuild
  if (!build) return false
  if (!sceneBackingBuildMatches(r, sceneVersion)) {
    cancelSceneBackingBuild(r)
    return false
  }

  const startedAt = now()
  const backing = sceneBackingMetrics(build)
  do {
    const childId = build.childIds[build.index]
    if (!childId) break
    renderBackingChild(r, build.graph, build.surface, childId, backing, build.sceneVersion)
    build.index++
  } while (build.index < build.childIds.length && now() - startedAt < SCENE_BACKING_BUILD_BUDGET_MS)

  if (build.index < build.childIds.length) return true

  let image: CKImage
  try {
    build.surface.flush()
    image = build.surface.makeImageSnapshot()
  } finally {
    build.surface.delete()
    r.sceneBackingBuild = null
  }
  installSceneBackingImage(r, image, build.sceneVersion, build.positionPreviewVersion, backing)
  emitNavigationTrace('backing:crisp', {
    buildMs: now() - build.startedAt,
    childCount: build.childIds.length,
    zoom: backing.zoom
  })
  r.sceneBackingAverageRecordMs = smoothAverage(
    r.sceneBackingAverageRecordMs,
    clamp(now() - build.startedAt, 1, 1_000)
  )
  return true
}

function recordSceneBacking(r: SkiaRenderer, graph: SceneGraph, sceneVersion: number): void {
  const startedAt = now()
  const backing = sceneBackingGeometry(r)
  const surface = createSceneBackingSurface(r, backing.width, backing.height)
  if (!surface) return
  const canvas = surface.getCanvas()
  try {
    canvas.clear(r.ck.Color4f(r.pageColor.r, r.pageColor.g, r.pageColor.b, 1))
    const pageNode = graph.getNode(r.pageId ?? graph.rootId)
    if (pageNode) {
      for (const childId of pageNode.childIds) {
        renderBackingChild(r, graph, surface, childId, backing, sceneVersion)
      }
    }
    surface.flush()
    const image = surface.makeImageSnapshot()
    installSceneBackingImage(r, image, sceneVersion, graph.positionPreviewVersion, backing)
    const recordMs = now() - startedAt
    emitNavigationTrace('backing:crisp', {
      buildMs: recordMs,
      childCount: pageNode?.childIds.length ?? 0,
      zoom: backing.zoom
    })
    r.sceneBackingAverageRecordMs = smoothAverage(
      r.sceneBackingAverageRecordMs,
      clamp(recordMs, 1, 1_000)
    )
  } finally {
    surface.delete()
  }
}

export function renderSceneBacking(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  sceneVersion: number
): false | 'backing' | 'retained-pictures' {
  if (r.sceneBackingAllocationFailed) return false
  const navigationActive = r.navigationPhase !== 'idle'
  if (navigationActive && r.sceneBacking) {
    r.sceneBackingBuild?.surface.delete()
    r.sceneBackingBuild = null
    r.sceneBackingNeedsCrispRender = true
    return drawSceneBacking(r, canvas, sceneVersion, true, graph.positionPreviewVersion)
      ? 'backing'
      : false
  }
  const positionPreviewVersion = graph.positionPreviewVersion
  const allowStaleZoom = now() < r.sceneBackingPreviewUntil
  const hasCoverage = backingCoverageContainsLiveViewport(
    r,
    sceneVersion,
    allowStaleZoom,
    positionPreviewVersion
  )
  if (!hasCoverage) {
    if (
      !r.sceneBacking ||
      !backingMetadataMatches(r, sceneVersion, positionPreviewVersion) ||
      !backingScreenCoverageContainsViewport(r)
    ) {
      cancelSceneBackingBuild(r)
      recordSceneBacking(r, graph, sceneVersion)
    } else {
      if (!sceneBackingBuildMatches(r, sceneVersion)) startSceneBackingBuild(r, graph, sceneVersion)
      stepSceneBackingBuild(r, sceneVersion)
    }
  } else if (r.sceneBackingBuild) {
    stepSceneBackingBuild(r, sceneVersion)
  }

  const crisp = backingPixelGridMatchesLiveViewport(r)
  r.sceneBackingNeedsCrispRender = allowStaleZoom || !crisp || !!r.sceneBackingBuild
  if (
    !allowStaleZoom &&
    !r.sceneBackingBuild &&
    backingMetadataMatches(r, sceneVersion, positionPreviewVersion)
  ) {
    drawSettledScene(r, canvas, graph, sceneVersion)
    return 'retained-pictures'
  }
  return drawSceneBacking(
    r,
    canvas,
    sceneVersion,
    allowStaleZoom || !!r.sceneBackingBuild,
    positionPreviewVersion
  )
    ? 'backing'
    : false
}
