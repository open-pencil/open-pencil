import { getDefaultCanvasBgColor } from '#core/constants'
import type { Color } from '#core/types'

import type { EditorContext } from './types'

interface PageViewport {
  panX: number
  panY: number
  zoom: number
  pageColor: Color
}

export function createPageViewportStore(ctx: EditorContext) {
  const pageViewports = new Map<string, PageViewport>()

  function saveCurrentPageViewport() {
    pageViewports.set(ctx.state.currentPageId, {
      panX: ctx.state.panX,
      panY: ctx.state.panY,
      zoom: ctx.state.zoom,
      pageColor: { ...ctx.state.pageColor }
    })
  }

  function restorePageViewport(pageId: string) {
    const viewport = pageViewports.get(pageId)
    if (viewport) {
      ctx.state.panX = viewport.panX
      ctx.state.panY = viewport.panY
      ctx.state.zoom = viewport.zoom
      ctx.state.pageColor = { ...viewport.pageColor }
      return
    }

    ctx.state.panX = 0
    ctx.state.panY = 0
    ctx.state.zoom = 1
    ctx.state.pageColor = { ...getDefaultCanvasBgColor() }
  }

  function deletePageViewport(pageId: string) {
    pageViewports.delete(pageId)
  }

  function clearPageViewports() {
    pageViewports.clear()
  }

  return { saveCurrentPageViewport, restorePageViewport, deletePageViewport, clearPageViewports }
}
