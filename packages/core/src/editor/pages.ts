import { limitAsync } from 'es-toolkit/promise'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { instanceMainComponent } from '@open-pencil/scene-graph/instances'
import type { Color } from '@open-pencil/scene-graph/primitives'

import {
  getPageColor,
  setDefaultPageBackground,
  setPageBackgrounds
} from '#core/figma-api/page-backgrounds'
import {
  canUseFigPopulationWorker,
  createFigPopulationWorker
} from '#core/kiwi/fig/population/client'
import { isReaderPagePending, recoverReaderPage } from '#core/kiwi/fig/session/document-state'
import { computeAllLayouts } from '#core/layout'
import { fontManager } from '#core/text/fonts'
import { collectGraphFontRequirements } from '#core/text/requirements'
import { missingGraphFontScripts } from '#core/text/resolved-requirements'

import { createPageViewportStore } from './page-viewports'
import { createPageLayouts } from './pages/layouts'
import { movePageInGraph } from './pages/move'
import type { EditorContext } from './types'

export interface PageSwitchProgress {
  phase:
    | 'populating-page'
    | 'resolving-fonts'
    | 'resolving-fallbacks'
    | 'layout'
    | 'drawing-shaders'
  detail?: string
  completed?: number
  total?: number
}

export interface PreparePageOptions {
  onProgress?: (progress: PageSwitchProgress) => void
  signal?: AbortSignal
}

export interface PreparedPage {
  pageId: string
  generation: number
}

export type SwitchPageOptions = PreparePageOptions

function throwIfAborted(signal?: AbortSignal): void {
  signal?.throwIfAborted()
}

const MAX_CONCURRENT_FONT_LOADS = 4
/** What preparing a page needs drawn once it is laid out, such as its shaders' frames. */
interface PageDrawing {
  drawPageShaderFrames(
    pageId: string,
    options: { signal?: AbortSignal; onProgress?: (progress: PageSwitchProgress) => void }
  ): Promise<void>
}

/**
 * The other pages that hold the component sets instances on `pageId` show a variant of,
 * nested instances included. A set on Figma's internal canvas is a copy of a library's, kept
 * with only what the file uses, so its page is left out.
 */
export function componentSetPages(graph: SceneGraph, pageId: string): string[] {
  const pages = new Set<string>()
  const visit = (id: string): void => {
    for (const node of graph.getChildren(id)) {
      if (node.type === 'INSTANCE') {
        const component = instanceMainComponent(graph, node)
        const set = component?.parentId ? graph.getNode(component.parentId) : undefined
        const setPageId = set?.type === 'COMPONENT_SET' ? graph.pageOf(set.id) : null
        const setPage = setPageId ? graph.getNode(setPageId) : undefined
        if (setPage && setPage.id !== pageId && !setPage.internalOnly) pages.add(setPage.id)
      }
      visit(node.id)
    }
  }
  visit(pageId)
  return [...pages]
}

export function createPageActions(ctx: EditorContext, drawing?: PageDrawing) {
  const pageViewportStore = createPageViewportStore(ctx)
  const pageLayouts = createPageLayouts(ctx)
  function syncPageColor() {
    ctx.state.pageColor = getPageColor(ctx.graph.getNode(ctx.state.currentPageId))
  }
  syncPageColor()
  ctx.onEditorEvent('graph:replaced', syncPageColor)
  ctx.onEditorEvent('node:updated', (id, changes) => {
    if (id === ctx.state.currentPageId && changes.source) syncPageColor()
  })
  let populationWorkerInstance: ReturnType<typeof createFigPopulationWorker> | undefined
  let populationWorkerGeneration = 0
  let pageSwitchGeneration = 0
  // Off-screen preparations per document, shared by concurrent callers and kept once they
  // succeed. Later edits lay out their own scope, as they do on the page on screen.
  const offscreenPreparations = new WeakMap<SceneGraph, Map<string, Promise<boolean>>>()

  function populationWorker() {
    if (!canUseFigPopulationWorker(ctx.graph)) return null
    populationWorkerInstance ??= createFigPopulationWorker(ctx.graph)
    return populationWorkerInstance
  }

  /** `switchGeneration` is null for a lookup, which no page switch can supersede. */
  async function populatePage(
    pageId: string,
    switchGeneration: number | null,
    signal?: AbortSignal
  ): Promise<boolean | null> {
    throwIfAborted(signal)
    const worker = populationWorker()
    const workerGeneration = populationWorkerGeneration
    const workerResult = worker ? await worker.populate(pageId, signal) : null
    throwIfAborted(signal)
    if (
      workerGeneration !== populationWorkerGeneration ||
      (switchGeneration !== null && switchGeneration !== pageSwitchGeneration)
    ) {
      return null
    }
    if (workerResult !== null) return workerResult
    worker?.terminate()
    populationWorkerInstance = undefined
    if (isReaderPagePending(ctx.graph, pageId)) {
      return recoverReaderPage(ctx.graph, pageId)
    }
    return false
  }

  async function resolvePageFonts(
    pageId: string,
    pageName: string,
    options: PreparePageOptions
  ): Promise<void> {
    const childIds = ctx.graph.getChildren(pageId).map((node) => node.id)
    const toLoad = fontManager.collectFontKeys(ctx.graph, childIds)
    const requirements = collectGraphFontRequirements(ctx.graph, childIds)
    options.onProgress?.({
      phase: 'resolving-fonts',
      detail: pageName,
      completed: 0,
      total: toLoad.length
    })
    fontManager.blockNodesUntilFontsResolve(childIds)
    try {
      let completedFaces = 0
      const loadFace = limitAsync(async ([family, style]: [string, string]) => {
        throwIfAborted(options.signal)
        const result = await ctx.loadFont(family, style, requirements.characters, options.signal)
        throwIfAborted(options.signal)
        completedFaces++
        options.onProgress?.({
          phase: 'resolving-fonts',
          detail: `${family} ${style}`,
          completed: completedFaces,
          total: toLoad.length
        })
        return result
      }, MAX_CONCURRENT_FONT_LOADS)
      const results = await Promise.all(toLoad.map(loadFace))
      throwIfAborted(options.signal)
      const requiredFallbacks = missingGraphFontScripts(requirements)
      options.onProgress?.({
        phase: 'resolving-fallbacks',
        detail: pageName,
        completed: 0,
        total: requiredFallbacks.length
      })
      const fallbacks = await fontManager.ensureFallbackPack(
        requiredFallbacks,
        requirements.characters,
        options.signal
      )
      throwIfAborted(options.signal)
      options.onProgress?.({
        phase: 'resolving-fallbacks',
        detail: pageName,
        completed: requiredFallbacks.length,
        total: requiredFallbacks.length
      })
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
  }

  async function preparePage(
    pageId: string,
    options: PreparePageOptions = {}
  ): Promise<PreparedPage | null> {
    const page = ctx.graph.getNode(pageId)
    if (page?.type !== 'CANVAS') return null
    const generation = ++pageSwitchGeneration
    throwIfAborted(options.signal)

    options.onProgress?.({ phase: 'populating-page', detail: page.name })
    const populated = await populatePage(pageId, generation, options.signal)
    if (populated === null || generation !== pageSwitchGeneration) return null
    // A file brings in only the variants a page uses; switching a variant, in the panel or in
    // preview, needs the rest of its set, laid out with its fonts, so the pages holding those
    // sets are prepared with this one, and the pages of sets their variants use in turn.
    const seen = new Set([pageId])
    const pending = componentSetPages(ctx.graph, pageId)
    for (let setPageId = pending.shift(); setPageId !== undefined; setPageId = pending.shift()) {
      if (seen.has(setPageId)) continue
      seen.add(setPageId)
      const ready = await preparePageNodes(setPageId)
      throwIfAborted(options.signal)
      if (!ready || generation !== pageSwitchGeneration) return null
      pending.push(...componentSetPages(ctx.graph, setPageId))
    }

    await resolvePageFonts(pageId, page.name, options)
    throwIfAborted(options.signal)
    if (generation !== pageSwitchGeneration) return null
    // A page visited before keeps the layout it got then, unless something it depends on changed.
    if ((ctx.getRenderer() || populated) && !pageLayouts.isCurrent(pageId)) {
      options.onProgress?.({ phase: 'layout', detail: page.name })
      ctx.graph.applyDerivedLayoutDuring(() => computeAllLayouts(ctx.graph, pageId))
      pageLayouts.record(pageId)
    }
    throwIfAborted(options.signal)
    if (generation !== pageSwitchGeneration) return null
    // Frames are drawn at the size layout gives each layer.
    await drawing?.drawPageShaderFrames(pageId, options)
    throwIfAborted(options.signal)
    return generation === pageSwitchGeneration ? { pageId, generation } : null
  }

  function commitPageSwitch(prepared: PreparedPage): boolean {
    if (prepared.generation !== pageSwitchGeneration) return false
    const page = ctx.graph.getNode(prepared.pageId)
    if (page?.type !== 'CANVAS') return false

    pageViewportStore.saveCurrentPageViewport()
    const previousPageId = ctx.state.currentPageId
    ctx.state.currentPageId = prepared.pageId
    ctx.state.enteredContainerId = null
    ctx.setSelectedIds(new Set())
    pageViewportStore.restorePageViewport(prepared.pageId)
    if (previousPageId !== prepared.pageId) {
      ctx.emitEditorEvent('page:changed', prepared.pageId, previousPageId)
    }
    ctx.requestRender()
    return true
  }

  /**
   * Loads a page's layers so they can be searched, without fonts, layout, or switching to
   * it — and without superseding a page switch the user has in progress.
   */
  async function loadPageNodes(pageId: string): Promise<void> {
    if (ctx.graph.getNode(pageId)?.type === 'CANVAS') await populatePage(pageId, null)
  }

  async function prepareOffscreenPage(graph: SceneGraph, page: SceneNode): Promise<boolean> {
    const populated = await populatePage(page.id, null)
    if (populated === null || graph !== ctx.graph) return false
    await resolvePageFonts(page.id, page.name, {})
    if (graph !== ctx.graph) return false
    graph.applyDerivedLayoutDuring(() => computeAllLayouts(graph, page.id))
    return true
  }

  /**
   * Loads a page's layers with their fonts and layout, ready to render, without switching to
   * it or superseding a page switch in progress. False when the document was closed or
   * replaced first. The page on screen already was prepared, when it was shown.
   */
  function preparePageNodes(pageId: string): Promise<boolean> {
    const graph = ctx.graph
    const page = graph.getNode(pageId)
    if (page?.type !== 'CANVAS') return Promise.resolve(false)
    if (pageId === ctx.state.currentPageId) return Promise.resolve(true)
    let preparations = offscreenPreparations.get(graph)
    if (!preparations) {
      preparations = new Map()
      offscreenPreparations.set(graph, preparations)
    }
    const pending = preparations.get(pageId)
    if (pending) return pending
    // A failed or superseded preparation is retried by the next caller.
    const forget = () => preparations.delete(pageId)
    const preparation = prepareOffscreenPage(graph, page).then(
      (ready) => {
        if (!ready) forget()
        return ready
      },
      (error: unknown) => {
        forget()
        throw error
      }
    )
    preparations.set(pageId, preparation)
    return preparation
  }

  async function switchPage(pageId: string, options: SwitchPageOptions = {}): Promise<void> {
    const prepared = await preparePage(pageId, options)
    if (prepared) commitPageSwitch(prepared)
  }

  /** Opens the page before or after the current one in the pages panel, stopping at the ends. */
  async function switchToAdjacentPage(step: 1 | -1): Promise<void> {
    const pages = ctx.graph.getPages()
    const index = pages.findIndex((page) => page.id === ctx.state.currentPageId)
    const next = index + step
    if (index === -1 || next < 0 || next >= pages.length) return
    await switchPage(pages[next].id)
  }

  function clearPageViewports() {
    populationWorkerGeneration++
    pageSwitchGeneration++
    populationWorkerInstance?.terminate()
    populationWorkerInstance = undefined
    pageViewportStore.clearPageViewports()
  }

  function addPage(name?: string) {
    const pages = ctx.graph.getPages()
    const pageName = name ?? `Page ${pages.length + 1}`
    const page = ctx.graph.addPage(pageName)
    setDefaultPageBackground(ctx.graph, page, ctx.state.theme)
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
    movePageInGraph(ctx.graph, pageId, index)
  }

  function renamePage(pageId: string, name: string) {
    ctx.graph.updateNode(pageId, { name })
  }

  function setPageColor(color: Color) {
    const page = ctx.graph.getNode(ctx.state.currentPageId)
    if (!page) return
    setPageBackgrounds(ctx.graph, page, [
      { type: 'SOLID', color: { ...color }, opacity: 1, visible: true, blendMode: 'NORMAL' }
    ])
    syncPageColor()
    ctx.requestRender()
  }

  /** Advances whenever a page switch starts, so a caller can tell it was overtaken. */
  function pageSwitchCount(): number {
    return pageSwitchGeneration
  }

  return {
    loadPageNodes,
    preparePageNodes,
    pageSwitchCount,
    preparePage,
    commitPageSwitch,
    switchPage,
    switchToNextPage: () => switchToAdjacentPage(1),
    switchToPreviousPage: () => switchToAdjacentPage(-1),
    addPage,
    deletePage,
    movePage,
    renamePage,
    setPageColor,
    clearPageViewports
  }
}
