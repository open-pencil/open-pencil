import type { EditorContext } from '#core/editor/types'
import { FIT_INSETS, fitViewport, pageContentBounds } from '#core/editor/viewport'
import { getPageColor } from '#core/figma-api/page-backgrounds'
import type { ViewportTransform } from '#core/geometry/types'

export function createPageViewportStore(ctx: EditorContext) {
  const pageViewports = new Map<string, ViewportTransform>()
  // Pages opened while the canvas had no size, so never fitted: they are not remembered at that
  // placeholder view, and their next visit fits them.
  const unfitted = new Set<string>()

  function isMeasured() {
    const { width, height } = ctx.getViewportSize()
    return width > 0 && height > 0
  }

  function saveCurrentPageViewport() {
    const pageId = ctx.state.currentPageId
    if (unfitted.has(pageId)) {
      if (!isMeasured()) return
      unfitted.delete(pageId)
    }
    pageViewports.set(ctx.state.currentPageId, {
      panX: ctx.state.panX,
      panY: ctx.state.panY,
      zoom: ctx.state.zoom
    })
  }

  /**
   * The view a page opens with, as in Figma: the one it was left at, or on its first visit every
   * layer fitted into the canvas, and the origin at the centre at 100% when it has none.
   */
  function firstVisitViewport(pageId: string): ViewportTransform {
    const size = ctx.getViewportSize()
    // Nothing to fit into a canvas not yet measured: the page opens at the origin at 100%, and a
    // host that reports its size later calls zoomToFit.
    if (!isMeasured()) {
      unfitted.add(pageId)
      return { panX: 0, panY: 0, zoom: 1 }
    }
    const bounds = pageContentBounds(ctx.graph, pageId)
    if (!bounds) return { panX: size.width / 2, panY: size.height / 2, zoom: 1 }
    return fitViewport(bounds, size, FIT_INSETS)
  }

  function restorePageViewport(pageId: string) {
    ctx.state.pageColor = getPageColor(ctx.graph.getNode(pageId))
    const viewport = pageViewports.get(pageId) ?? firstVisitViewport(pageId)
    ctx.state.panX = viewport.panX
    ctx.state.panY = viewport.panY
    ctx.state.zoom = viewport.zoom
  }

  function deletePageViewport(pageId: string) {
    pageViewports.delete(pageId)
    unfitted.delete(pageId)
  }

  function clearPageViewports() {
    pageViewports.clear()
    unfitted.clear()
  }

  return { saveCurrentPageViewport, restorePageViewport, deletePageViewport, clearPageViewports }
}
