import { ZOOM_DIVISOR, ZOOM_SCALE_MAX, ZOOM_SCALE_MIN } from '../constants'
import { computeBounds, computeAbsoluteBounds } from '../geometry'

import type { EditorContext } from './types'

export function createViewportActions(ctx: EditorContext) {
  function screenToCanvas(sx: number, sy: number) {
    return {
      x: (sx - ctx.state.panX) / ctx.state.zoom,
      y: (sy - ctx.state.panY) / ctx.state.zoom
    }
  }

  function applyZoom(delta: number, centerX: number, centerY: number) {
    const factor = Math.min(
      ZOOM_SCALE_MAX,
      Math.max(ZOOM_SCALE_MIN, Math.exp(-delta / ZOOM_DIVISOR))
    )
    const newZoom = Math.max(0.02, Math.min(256, ctx.state.zoom * factor))
    ctx.state.panX = centerX - (centerX - ctx.state.panX) * (newZoom / ctx.state.zoom)
    ctx.state.panY = centerY - (centerY - ctx.state.panY) * (newZoom / ctx.state.zoom)
    ctx.state.zoom = newZoom
    ctx.requestRepaint()
  }

  function pan(dx: number, dy: number) {
    ctx.state.panX += dx
    ctx.state.panY += dy
    ctx.requestRepaint()
  }

  function zoomToBounds(minX: number, minY: number, maxX: number, maxY: number) {
    const padding = 80
    const w = maxX - minX + padding * 2
    const h = maxY - minY + padding * 2

    const { width: viewW, height: viewH } = ctx.getViewportSize()
    const zoom = Math.min(viewW / w, viewH / h, 1)

    ctx.state.zoom = zoom
    ctx.state.panX = (viewW - w * zoom) / 2 - minX * zoom + padding * zoom
    ctx.state.panY = (viewH - h * zoom) / 2 - minY * zoom + padding * zoom
    ctx.requestRepaint()
  }

  function zoomToFit() {
    const nodes = ctx.graph.getChildren(ctx.state.currentPageId)
    if (nodes.length === 0) return

    const b = computeBounds(nodes)
    zoomToBounds(b.x, b.y, b.x + b.width, b.y + b.height)
  }

  function zoomTo100() {
    const { width: viewW, height: viewH } = ctx.getViewportSize()
    const centerX = (-ctx.state.panX + viewW / 2) / ctx.state.zoom
    const centerY = (-ctx.state.panY + viewH / 2) / ctx.state.zoom

    ctx.state.zoom = 1
    ctx.state.panX = viewW / 2 - centerX
    ctx.state.panY = viewH / 2 - centerY
    ctx.requestRepaint()
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

  return { screenToCanvas, applyZoom, pan, zoomToBounds, zoomToFit, zoomTo100, zoomToSelection }
}
