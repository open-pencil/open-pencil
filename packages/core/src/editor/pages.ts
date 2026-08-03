import type { Color } from '@open-pencil/scene-graph/primitives'

import { DECK_CANVAS_BG_COLOR } from '#core/constants'
import { populateLazyFigImportRoots } from '#core/kiwi/fig/lazy-import'
import { computeAllLayouts } from '#core/layout'
import { fontManager } from '#core/text/fonts'
import { collectGraphFontRequirements } from '#core/text/requirements'
import { missingGraphFontScripts } from '#core/text/resolved-requirements'

import type { DocumentKind } from './document-kind'
import { writeStoredPageColor } from './page-color'
import { createPageViewportStore } from './page-viewports'
import type { EditorContext } from './types'

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

    const populated = populateLazyFigImportRoots(ctx.graph, [pageId])

    const childIds = ctx.graph.getChildren(pageId).map((node) => node.id)
    const toLoad = fontManager.collectFontKeys(ctx.graph, childIds)
    const requirements = collectGraphFontRequirements(ctx.graph, childIds)
    fontManager.blockNodesUntilFontsResolve(childIds)
    // Only a font actually resolving invalidates cached pictures. Switching page does not
    // change the scene, and wiping every tier on each advance forced a full re-record —
    // re-shaping every text node — even when returning to a slide shown seconds ago.
    let fontsChangedText = false
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
        for (const node of requirements.nodes) {
          if (node.type !== 'TEXT') continue
          if (node.textPicture !== null) fontsChangedText = true
          node.textPicture = null
        }
      }
    } finally {
      fontManager.unblockNodes(childIds)
      if (fontsChangedText || populated) ctx.getRenderer()?.invalidateAllPictures()
    }
    if (ctx.getRenderer() || populated) {
      computeAllLayouts(ctx.graph, pageId)
    }
    // `requestRender` bumps sceneVersion, which every picture cache is keyed on. Reserve it
    // for the case where this switch genuinely changed the scene; otherwise a repaint is
    // all a page change needs, and the caches survive.
    if (fontsChangedText || populated) ctx.requestRender()
    else ctx.requestRepaint()
    ctx.emitEditorEvent('page:ready', pageId)
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
    // Deck / slides documents use a fixed zoomed-out backdrop; ignore user edits.
    if (pageViewportStore.isBackdropLocked()) {
      ctx.state.pageColor = { ...DECK_CANVAS_BG_COLOR }
      ctx.requestRender()
      return
    }

    ctx.state.pageColor = color
    // Persist it. Export reads `backgroundColor` off the page's imported fields
    // and copied it through verbatim, so a stage colour the user chose was
    // never written to the file — it lived and died in editor state.
    writeStoredPageColor(ctx.graph, ctx.state.currentPageId, color)
    ctx.requestRender()
  }

  /**
   * Switch the document kind. Single entry point for "this is a deck" / "this is a design
   * file" — everything format-specific derives from it, so nothing else needs setting.
   */
  function setDocumentKind(kind: DocumentKind) {
    ctx.state.documentKind = kind
    pageViewportStore.applyBackdrop()
  }

  return {
    switchPage,
    addPage,
    deletePage,
    movePage,
    renamePage,
    setPageColor,
    setDocumentKind,
    clearPageViewports: pageViewportStore.clearPageViewports
  }
}
