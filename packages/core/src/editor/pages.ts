import type { Color } from '@open-pencil/scene-graph/primitives'

import { populateLazyFigImportRoots } from '#core/kiwi/fig/lazy-import'
import {
  canUseFigPopulationWorker,
  createFigPopulationWorker
} from '#core/kiwi/fig/population/client'
import { computeAllLayouts } from '#core/layout'
import { fontManager } from '#core/text/fonts'
import { collectGraphFontRequirements } from '#core/text/requirements'
import { missingGraphFontScripts } from '#core/text/resolved-requirements'

import { createPageViewportStore } from './page-viewports'
import type { EditorContext } from './types'

export function createPageActions(ctx: EditorContext, zoomToFit: () => void) {
  const pageViewportStore = createPageViewportStore(ctx)
  let populationWorkerInstance: ReturnType<typeof createFigPopulationWorker> | undefined
  let populationWorkerGeneration = 0
  let pageSwitchGeneration = 0

  function populationWorker() {
    if (!canUseFigPopulationWorker(ctx.graph)) return null
    populationWorkerInstance ??= createFigPopulationWorker(ctx.graph)
    return populationWorkerInstance
  }

  async function switchPage(pageId: string) {
    const page = ctx.graph.getNode(pageId)
    if (page?.type !== 'CANVAS') return
    const switchGeneration = ++pageSwitchGeneration

    const previousPageId = ctx.state.currentPageId
    if (previousPageId !== pageId) pageViewportStore.saveCurrentPageViewport()
    ctx.state.currentPageId = pageId
    ctx.state.enteredContainerId = null
    ctx.setSelectedIds(new Set())
    if (previousPageId !== pageId) ctx.emitEditorEvent('page:changed', pageId, previousPageId)

    const restoredViewport = pageViewportStore.restorePageViewport(pageId)

    ctx.state.loading = true
    let populated: boolean
    try {
      const worker = populationWorker()
      const workerGeneration = populationWorkerGeneration
      const workerResult = worker ? await worker.populate(pageId) : null
      if (workerGeneration !== populationWorkerGeneration) return
      if (workerResult === null) {
        worker?.terminate()
        populationWorkerInstance = undefined
        populated = populateLazyFigImportRoots(ctx.graph, [pageId])
      } else {
        populated = workerResult
      }
    } finally {
      if (switchGeneration === pageSwitchGeneration) ctx.state.loading = false
    }
    if (switchGeneration !== pageSwitchGeneration) return

    const childIds = ctx.graph.getChildren(pageId).map((node) => node.id)
    const toLoad = fontManager.collectFontKeys(ctx.graph, childIds)
    const requirements = collectGraphFontRequirements(ctx.graph, childIds)
    fontManager.blockNodesUntilFontsResolve(childIds)
    try {
      const results = await Promise.all(
        toLoad.map(([family, style]) => ctx.loadFont(family, style, requirements.characters))
      )
      const requiredFallbacks = missingGraphFontScripts(requirements)
      const fallbacks = await fontManager.ensureFallbackPack(
        requiredFallbacks,
        requirements.characters
      )
      const facesReady = results.every((result) => result !== null)
      const fallbacksReady = requiredFallbacks.every(
        (script) => (fallbacks[script]?.length ?? 0) > 0
      )
      if (facesReady && fallbacksReady) {
        for (const node of requirements.nodes) if (node.type === 'TEXT') node.textPicture = null
      }
    } finally {
      fontManager.unblockNodes(childIds)
      ctx.getRenderer()?.invalidateAllPictures()
    }
    if (ctx.getRenderer() || populated) {
      computeAllLayouts(ctx.graph, pageId)
    }
    if (!restoredViewport) {
      zoomToFit()
      pageViewportStore.saveCurrentPageViewport()
    }
    ctx.requestRender()
  }

  function clearPageViewports() {
    populationWorkerGeneration++
    pageSwitchGeneration++
    ctx.state.loading = false
    populationWorkerInstance?.terminate()
    populationWorkerInstance = undefined
    pageViewportStore.clearPageViewports()
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
    ctx.requestRender()
  }

  return {
    switchPage,
    addPage,
    deletePage,
    movePage,
    renamePage,
    setPageColor,
    clearPageViewports
  }
}
