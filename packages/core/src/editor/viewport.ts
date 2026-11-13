import type { SceneGraph } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { ZOOM_DIVISOR, ZOOM_MAX, ZOOM_MIN, ZOOM_SCALE_MAX, ZOOM_SCALE_MIN } from '#core/constants'
import type { ViewportTransform } from '#core/geometry/types'
import { emitNavigationTrace } from '#core/profiler'

import type { EditorContext } from './types'

/** Space kept between revealed layers and the viewport edge. */
const REVEAL_MARGIN = 48

/** Screen pixels between the canvas edge and layers fitted into it. */
export interface ViewportInsets {
  left: number
  right: number
  top: number
  bottom: number
}

/**
 * Figma's insets for zoom to fit and the first visit of a page, measured on its canvas, less what
 * its toolbar takes: 35 px a side, plus 10 px left and top less 10 px right for its chrome.
 */
export const FIT_INSETS: ViewportInsets = { left: 45, right: 25, top: 45, bottom: 35 }

/** Figma's insets for zoom to selection: 50 px a side, with the same chrome. */
export const SELECTION_INSETS: ViewportInsets = { left: 60, right: 40, top: 60, bottom: 50 }

/**
 * What floating UI over each canvas edge adds to the insets: by default the 50 px Figma keeps at
 * the bottom for its toolbar. A host whose toolbar sits elsewhere reports its own.
 */
export const DEFAULT_VIEWPORT_CHROME: ViewportInsets = { left: 0, right: 0, top: 0, bottom: 50 }

/** `insets` widened by the `chrome` floating over each edge. */
export function withChrome(insets: ViewportInsets, chrome: ViewportInsets): ViewportInsets {
  return {
    left: insets.left + chrome.left,
    right: insets.right + chrome.right,
    top: insets.top + chrome.top,
    bottom: insets.bottom + chrome.bottom
  }
}

/**
 * The world box the page's visible top-level layers take, rotation included; null when it shows
 * none. As in Figma, hidden layers count for nothing and each layer counts by its own box, so
 * children drawn outside an unclipped frame are left out.
 */
export function pageContentBounds(
  graph: Pick<SceneGraph, 'getChildren' | 'getNode'>,
  pageId: string
): Rect | null {
  const nodes = graph.getChildren(pageId).filter((node) => node.visible)
  if (nodes.length === 0) return null
  return computeBounds(nodes.map((node) => getAxisAlignedWorldBounds(node, graph)))
}

function clampZoom(zoom: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom))
}

/**
 * The viewport that fills the `size` canvas less `insets` with `bounds`, centred there, as Figma
 * fits layers: zoomed past 100% for small layers, to the maximum zoom for a point, unless
 * `maxZoom` stops it sooner.
 */
export function fitViewport(
  bounds: Rect,
  size: { width: number; height: number },
  insets: ViewportInsets,
  maxZoom = ZOOM_MAX
): ViewportTransform {
  // A canvas too small for the insets fits into all of itself rather than a negative area.
  const fitted = size.width > insets.left + insets.right && size.height > insets.top + insets.bottom
  const { left, top } = fitted ? insets : { left: 0, top: 0 }
  const areaWidth = fitted ? size.width - insets.left - insets.right : size.width
  const areaHeight = fitted ? size.height - insets.top - insets.bottom : size.height
  const fit = Math.min(areaWidth / bounds.width, areaHeight / bounds.height)
  const zoom = clampZoom(Math.min(Number.isNaN(fit) ? 1 : fit, maxZoom))
  return {
    zoom,
    panX: left + areaWidth / 2 - (bounds.x + bounds.width / 2) * zoom,
    panY: top + areaHeight / 2 - (bounds.y + bounds.height / 2) * zoom
  }
}

export function createViewportActions(ctx: EditorContext) {
  function currentViewport() {
    return { panX: ctx.state.panX, panY: ctx.state.panY, zoom: ctx.state.zoom }
  }

  function emitViewportChanged(previous: ReturnType<typeof currentViewport>) {
    const next = currentViewport()
    if (next.panX !== previous.panX || next.panY !== previous.panY || next.zoom !== previous.zoom) {
      emitNavigationTrace('viewport:changed', {
        panX: next.panX,
        panY: next.panY,
        zoom: next.zoom,
        previousPanX: previous.panX,
        previousPanY: previous.panY,
        previousZoom: previous.zoom
      })
      ctx.emitEditorEvent('viewport:changed', next, previous)
    }
  }

  function screenToCanvas(sx: number, sy: number) {
    return {
      x: (sx - ctx.state.panX) / ctx.state.zoom,
      y: (sy - ctx.state.panY) / ctx.state.zoom
    }
  }

  function setZoomAroundPoint(level: number, centerX: number, centerY: number) {
    const previous = currentViewport()
    const newZoom = clampZoom(level)
    ctx.state.panX = centerX - (centerX - ctx.state.panX) * (newZoom / ctx.state.zoom)
    ctx.state.panY = centerY - (centerY - ctx.state.panY) * (newZoom / ctx.state.zoom)
    ctx.state.zoom = newZoom
    ctx.requestRepaint()
    emitViewportChanged(previous)
  }

  function applyZoom(delta: number, centerX: number, centerY: number) {
    const factor = Math.min(
      ZOOM_SCALE_MAX,
      Math.max(ZOOM_SCALE_MIN, Math.exp(-delta / ZOOM_DIVISOR))
    )
    setZoomAroundPoint(ctx.state.zoom * factor, centerX, centerY)
  }

  function pan(dx: number, dy: number) {
    const previous = currentViewport()
    ctx.state.panX += dx
    ctx.state.panY += dy
    ctx.requestRepaint()
    emitViewportChanged(previous)
  }

  /**
   * Fills the canvas less `insets` and the chrome over its edges with the world rectangle,
   * centred, zooming in or out as needed, and in no further than `maxZoom`.
   */
  function zoomToBounds(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    {
      insets = SELECTION_INSETS,
      maxZoom = ZOOM_MAX
    }: { insets?: ViewportInsets; maxZoom?: number } = {}
  ) {
    const previous = currentViewport()
    const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    const next = fitViewport(
      bounds,
      ctx.getViewportSize(),
      withChrome(insets, ctx.getViewportChrome()),
      maxZoom
    )
    ctx.state.zoom = next.zoom
    ctx.state.panX = next.panX
    ctx.state.panY = next.panY
    ctx.requestRepaint()
    emitViewportChanged(previous)
  }

  /** Put the world point (x, y) at the center of the viewport, at `zoom` (the current one by default). */
  function centerOn(x: number, y: number, zoom = ctx.state.zoom) {
    const previous = currentViewport()
    const { width, height } = ctx.getViewportSize()
    const nextZoom = clampZoom(zoom)
    const panX = width / 2 - x * nextZoom
    const panY = height / 2 - y * nextZoom
    // Remote cursors are finite but unbounded; a point that overflows leaves the view alone.
    if (!Number.isFinite(panX) || !Number.isFinite(panY)) return
    ctx.state.zoom = nextZoom
    ctx.state.panX = panX
    ctx.state.panY = panY
    ctx.requestRepaint()
    emitViewportChanged(previous)
  }

  /** Figma's Shift+1: every layer of the page fitted; an empty page shows its origin at 100%. */
  function zoomToFit() {
    const b = pageContentBounds(ctx.graph, ctx.state.currentPageId)
    if (!b) {
      centerOn(0, 0, 1)
      return
    }
    zoomToBounds(b.x, b.y, b.x + b.width, b.y + b.height, { insets: FIT_INSETS })
  }

  function zoomToLevel(level: number) {
    const { width: viewW, height: viewH } = ctx.getViewportSize()
    const centerX = (-ctx.state.panX + viewW / 2) / ctx.state.zoom
    const centerY = (-ctx.state.panY + viewH / 2) / ctx.state.zoom

    const previous = currentViewport()
    ctx.state.zoom = clampZoom(level)
    // Keep the world point at the center of the viewport where it was.
    ctx.state.panX = viewW / 2 - centerX * ctx.state.zoom
    ctx.state.panY = viewH / 2 - centerY * ctx.state.zoom
    ctx.requestRepaint()
    emitViewportChanged(previous)
  }

  function zoomTo100() {
    zoomToLevel(1)
  }

  function zoomToSelection() {
    if (ctx.state.selectedIds.size === 0) return

    const nodes = [...ctx.state.selectedIds]
      .map((id) => ctx.graph.getNode(id))
      .filter((n): n is NonNullable<typeof n> => n != null)
    if (nodes.length === 0) return

    const b = computeBounds(nodes.map((node) => getAxisAlignedWorldBounds(node, ctx.graph)))
    zoomToBounds(b.x, b.y, b.x + b.width, b.y + b.height)
  }

  /**
   * Brings layers into view: pans to center them when they fit at the current zoom and are not
   * already visible, and zooms out to fit them only when they do not fit.
   */
  function revealNodes(nodeIds: readonly string[], margin = REVEAL_MARGIN) {
    const nodes = nodeIds.map((id) => ctx.graph.getNode(id)).filter((node) => node !== undefined)
    if (nodes.length === 0) return
    const bounds = computeBounds(nodes.map((node) => getAxisAlignedWorldBounds(node, ctx.graph)))
    const { width, height } = ctx.getViewportSize()
    const { zoom, panX, panY } = ctx.state
    const fits =
      bounds.width * zoom <= width - margin * 2 && bounds.height * zoom <= height - margin * 2
    if (!fits) {
      zoomToBounds(bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height)
      return
    }
    const left = bounds.x * zoom + panX
    const top = bounds.y * zoom + panY
    const right = left + bounds.width * zoom
    const bottom = top + bounds.height * zoom
    const visible =
      left >= margin && top >= margin && right <= width - margin && bottom <= height - margin
    if (visible) return
    pan(width / 2 - (left + right) / 2, height / 2 - (top + bottom) / 2)
  }

  return {
    revealNodes,
    screenToCanvas,
    setZoomAroundPoint,
    applyZoom,
    pan,
    zoomToBounds,
    centerOn,
    zoomToFit,
    zoomTo100,
    zoomToLevel,
    zoomToSelection
  }
}
