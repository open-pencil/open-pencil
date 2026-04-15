import { getDefaultCanvasBgColor } from '../constants'
import { computeAllLayouts } from '../layout'
import { collectFontKeys } from '../text/fonts'

import type { Color } from '../types'
import type { EditorContext } from './types'

interface PageViewport {
  panX: number
  panY: number
  zoom: number
  pageColor: Color
}

export function createPageActions(ctx: EditorContext) {
  const pageViewports = new Map<string, PageViewport>()

  async function switchPage(pageId: string) {
    const page = ctx.graph.getNode(pageId)
    if (page?.type !== 'CANVAS') return

    pageViewports.set(ctx.state.currentPageId, {
      panX: ctx.state.panX,
      panY: ctx.state.panY,
      zoom: ctx.state.zoom,
      pageColor: { ...ctx.state.pageColor }
    })

    ctx.state.currentPageId = pageId
    ctx.state.enteredContainerId = null
    ctx.state.selectedIds = new Set()

    const vp = pageViewports.get(pageId)
    if (vp) {
      ctx.state.panX = vp.panX
      ctx.state.panY = vp.panY
      ctx.state.zoom = vp.zoom
      ctx.state.pageColor = { ...vp.pageColor }
    } else {
      ctx.state.panX = 0
      ctx.state.panY = 0
      ctx.state.zoom = 1
      ctx.state.pageColor = { ...getDefaultCanvasBgColor() }
    }

    const toLoad = collectFontKeys(
      ctx.graph,
      ctx.graph.getChildren(pageId).map((n) => n.id)
    )
    if (toLoad.length > 0) {
      await Promise.all(toLoad.map(([family, style]) => ctx.loadFont(family, style)))
    }
    if (ctx.getRenderer()) {
      computeAllLayouts(ctx.graph, pageId)
    }
    ctx.requestRender()
  }

  function addPage(name?: string) {
    const pages = ctx.graph.getPages()
    const pageName = name ?? `Page ${pages.length + 1}`
    const page = ctx.graph.addPage(pageName)
    void switchPage(page.id)
    return page.id
  }

  function deletePage(pageId: string) {
    const pages = ctx.graph.getPages()
    if (pages.length <= 1) return
    const idx = pages.findIndex((p) => p.id === pageId)
    ctx.graph.deleteNode(pageId)
    pageViewports.delete(pageId)
    if (ctx.state.currentPageId === pageId) {
      const newIdx = Math.min(idx, pages.length - 2)
      const remaining = ctx.graph.getPages()
      void switchPage(remaining[newIdx].id)
    }
  }

  function renamePage(pageId: string, name: string) {
    ctx.graph.updateNode(pageId, { name })
  }

  function setPageColor(color: Color) {
    ctx.state.pageColor = color
    ctx.requestRender()
  }

  function clearPageViewports() {
    pageViewports.clear()
  }

  return { switchPage, addPage, deletePage, renamePage, setPageColor, clearPageViewports }
}
