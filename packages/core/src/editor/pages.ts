import { computeAllLayouts } from '#core/layout'
import { fontManager } from '#core/text/fonts'
import type { Color } from '#core/types'

import { createPageViewportStore } from './page-viewports'
import type { EditorContext } from './types'

export function createPageActions(ctx: EditorContext) {
  const pageViewportStore = createPageViewportStore(ctx)

  async function switchPage(pageId: string) {
    const page = ctx.graph.getNode(pageId)
    if (page?.type !== 'CANVAS') return

    pageViewportStore.saveCurrentPageViewport()

    ctx.state.currentPageId = pageId
    ctx.state.enteredContainerId = null
    ctx.state.selectedIds = new Set()

    pageViewportStore.restorePageViewport(pageId)

    const toLoad = fontManager.collectFontKeys(
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
    pageViewportStore.deletePageViewport(pageId)
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

  return {
    switchPage,
    addPage,
    deletePage,
    renamePage,
    setPageColor,
    clearPageViewports: pageViewportStore.clearPageViewports
  }
}
