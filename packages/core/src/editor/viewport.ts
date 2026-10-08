import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'
import { computeBounds, computeAbsoluteBounds } from '@open-pencil/scene-graph/geometry'

import { ZOOM_DIVISOR, ZOOM_SCALE_MAX, ZOOM_SCALE_MIN } from '#core/constants'
import { emitNavigationTrace } from '#core/profiler'

import type { EditorContext } from './types'

/** Space kept between revealed layers and the viewport edge. */
const REVEAL_MARGIN = 48

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
    const newZoom = Math.max(0.02, Math.min(256, level))
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

  function zoomToBounds(minX: number, minY: number, maxX: number, maxY: number) {
    const previous = currentViewport()
    const padding = 80
    const w = maxX - minX + padding * 2
    const h = maxY - minY + padding * 2

    const { width: viewW, height: viewH } = ctx.getViewportSize()
    const zoom = Math.min(viewW / w, viewH / h, 1)

    ctx.state.zoom = zoom
    ctx.state.panX = (viewW - w * zoom) / 2 - minX * zoom + padding * zoom
    ctx.state.panY = (viewH - h * zoom) / 2 - minY * zoom + padding * zoom
    ctx.requestRepaint()
    emitViewportChanged(previous)
  }

  /** Put the world point (x, y) at the center of the viewport, at `zoom` (the current one by default). */
  function centerOn(x: number, y: number, zoom = ctx.state.zoom) {
    const previous = currentViewport()
    const { width, height } = ctx.getViewportSize()
    const nextZoom = Math.max(0.02, Math.min(256, zoom))
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

  function zoomToFit() {
    const nodes = ctx.graph.getChildren(ctx.state.currentPageId)
    if (nodes.length === 0) return

    const b = computeBounds(nodes)
    zoomToBounds(b.x, b.y, b.x + b.width, b.y + b.height)
  }

  function zoomToLevel(level: number) {
    const { width: viewW, height: viewH } = ctx.getViewportSize()
    const centerX = (-ctx.state.panX + viewW / 2) / ctx.state.zoom
    const centerY = (-ctx.state.panY + viewH / 2) / ctx.state.zoom

    const previous = currentViewport()
    ctx.state.zoom = Math.max(0.02, Math.min(256, level))
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

    const b = computeAbsoluteBounds(nodes, (id) => ctx.graph.getAbsolutePosition(id))
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
