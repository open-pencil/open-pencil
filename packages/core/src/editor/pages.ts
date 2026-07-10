import type { SceneNode } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { populateLazyFigImportRoots } from '#core/kiwi/fig/lazy-import'
import { computeAllLayouts } from '#core/layout'
import { fontManager } from '#core/text/fonts'

import { createPageViewportStore } from './page-viewports'
import type { EditorContext } from './types'

/** Page background persisted as the fig canvas backgroundColor (raw passthrough). */
function readPageBackgroundColor(page: SceneNode | null | undefined): Color | null {
  const raw = page?.source.fig.rawNodeFields['backgroundColor'] as Partial<Color> | undefined
  if (!raw || typeof raw.r !== 'number' || typeof raw.g !== 'number' || typeof raw.b !== 'number') {
    return null
  }
  return { r: raw.r, g: raw.g, b: raw.b, a: typeof raw.a === 'number' ? raw.a : 1 }
}

export function createPageActions(ctx: EditorContext) {
  const pageViewportStore = createPageViewportStore(ctx)

  async function switchPage(pageId: string) {
    const page = ctx.graph.getNode(pageId)
    if (page?.type !== 'CANVAS') return

    pageViewportStore.saveCurrentPageViewport()

    const previousPageId = ctx.state.currentPageId
    ctx.state.currentPageId = pageId
    ctx.state.enteredContainerId = null
    ctx.setSelectedIds(new Set())
    if (previousPageId !== pageId) ctx.emitEditorEvent('page:changed', pageId, previousPageId)

    pageViewportStore.restorePageViewport(pageId)

    // The document's stored page color wins over the session default so a
    // reopened file keeps the color the user chose (fixes revert to #F5F5F5)
    const storedColor = readPageBackgroundColor(page)
    if (storedColor) ctx.state.pageColor = storedColor

    const populated = populateLazyFigImportRoots(ctx.graph, [pageId])

    const toLoad = fontManager.collectFontKeys(
      ctx.graph,
      ctx.graph.getChildren(pageId).map((n) => n.id)
    )
    if (toLoad.length > 0) {
      await Promise.all(toLoad.map(([family, style]) => ctx.loadFont(family, style)))
    }
    if (ctx.getRenderer() || populated) {
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

  function movePage(pageId: string, index: number) {
    const pages = ctx.graph.getPages()
    const currentIndex = pages.findIndex((page) => page.id === pageId)
    if (currentIndex === -1) return

    const nextIndex = Math.max(0, Math.min(index, pages.length - 1))
    if (nextIndex === currentIndex) return

    ctx.graph.insertChildAt(pageId, ctx.graph.rootId, nextIndex)
  }

  function renamePage(pageId: string, name: string) {
    ctx.graph.updateNode(pageId, { name })
  }

  function setPageColor(color: Color) {
    ctx.state.pageColor = color
    // Persist on the page node — backgroundColor is part of the .fig canvas
    // payload, so the color survives save/reload and round-trips to Figma.
    const page = ctx.graph.getNode(ctx.state.currentPageId)
    if (page) {
      ctx.graph.updateNode(page.id, {
        source: {
          ...page.source,
          fig: {
            ...page.source.fig,
            rawNodeFields: { ...page.source.fig.rawNodeFields, backgroundColor: { ...color } }
          }
        }
      })
    }
    ctx.requestRender()
  }

  return {
    switchPage,
    addPage,
    deletePage,
    movePage,
    renamePage,
    setPageColor,
    clearPageViewports: pageViewportStore.clearPageViewports
  }
}
