import { computeAllLayouts } from '@open-pencil/core/layout'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { yieldToUI } from '@/app/document/io/browser'
import type { EditorStore } from '@/app/editor/session'

import { createAnnouncementSection } from './announcement/section'
import { loadDemoFonts } from './fonts'
import { createPaintSection } from './paint/section'
import { createComponentsSection } from './sections/components'
import { createDemoVariables } from './sections/variables'
import { createTypographySection } from './typography/section'
import { fitDemoPagesOnFirstVisit } from './viewport'

const PAGE_ORIGIN = 60
const PAGE_GAP = 64

type DemoPreparation = ReturnType<EditorStore['preparationController']['begin']>

interface DemoBuildState {
  initialPageId: string
  initialPageName: string | null
  preexistingCollections: ReadonlySet<string>
  createdRootIds: string[]
  createdPageIds: string[]
}

interface DemoBuild {
  graph: SceneGraph
  state: DemoBuildState
  /** Resolves false when the build was abandoned before it finished. */
  run: () => Promise<boolean>
}

/**
 * A superseded or failed build must not leave a half-built document behind, so the pages,
 * sections, and variables it added are removed again. Guarded by graph identity because node
 * and page IDs are only unique within one graph.
 */
function rollbackBuild(store: EditorStore, graph: SceneGraph, state: DemoBuildState): void {
  if (store.graph !== graph) return
  for (const rootId of state.createdRootIds) {
    if (graph.getNode(rootId)) graph.deleteNode(rootId)
  }
  for (const pageId of state.createdPageIds) {
    if (graph.getNode(pageId)) store.deletePage(pageId)
  }
  for (const collectionId of Array.from(graph.variableCollections.keys())) {
    if (!state.preexistingCollections.has(collectionId)) graph.removeCollection(collectionId)
  }
  if (state.initialPageName !== null) {
    graph.updateNode(state.initialPageId, { name: state.initialPageName })
  }
  store.clearSelection()
}

function reportDemoFailure(preparation: DemoPreparation, error: unknown): void {
  if (preparation.signal.aborted) return
  preparation.fail({
    code: 'layout-failed',
    message: error instanceof Error ? error.message : String(error),
    retryable: true
  })
  console.warn('[Demo] Failed to prepare the demo document:', error)
}

/**
 * Builds the demo document while reporting the same preparation phases as a document open, so
 * the canvas overlay and tab indicator cover generation instead of an empty canvas.
 */
function createDemoBuild(store: EditorStore, preparation: DemoPreparation): DemoBuild {
  const graph = store.graph
  const state: DemoBuildState = {
    initialPageId: store.state.currentPageId,
    initialPageName: graph.getNode(store.state.currentPageId)?.name ?? null,
    preexistingCollections: new Set(graph.variableCollections.keys()),
    createdRootIds: [],
    createdPageIds: []
  }
  const abandoned = () => store.graph !== graph || preparation.signal.aborted
  const step = (completed: number) =>
    preparation.update({ phase: 'materializing', completed, total: 4, unit: 'pages' })

  async function run(): Promise<boolean> {
    await store.canvasReady
    // A file opened while the canvas was loading must not receive demo content.
    if (
      abandoned() ||
      store.state.currentPageId !== state.initialPageId ||
      graph.getPages().length !== 1 ||
      graph.getChildren(state.initialPageId).length > 0
    )
      return false

    step(0)
    await yieldToUI()
    await loadDemoFonts()

    graph.updateNode(state.initialPageId, { name: '01 · Components & variables' })
    const typography = graph.addPage('02 · Typography')
    const paint = graph.addPage('03 · Paint & effects')
    state.createdPageIds.push(typography.id, paint.id)

    // Build page 01 while it is still the current page, so shape creation inside
    // the section helpers lands here rather than on a leftover empty page.
    const announcement = await createAnnouncementSection(graph, state.initialPageId)
    state.createdRootIds.push(announcement.rootId)
    graph.updateNode(announcement.rootId, { x: PAGE_ORIGIN, y: PAGE_ORIGIN })
    step(1)
    if (abandoned()) return false

    computeAllLayouts(graph, state.initialPageId)
    const components = await createComponentsSection(graph, state.initialPageId, {
      x: PAGE_ORIGIN,
      y: PAGE_ORIGIN + (graph.getNode(announcement.rootId)?.height ?? 0) + PAGE_GAP
    })
    state.createdRootIds.push(components.rootId)
    createDemoVariables(store)
    step(2)
    if (abandoned()) return false

    await createTypographySection(graph, typography.id)
    step(3)
    if (abandoned()) return false

    await createPaintSection(graph, paint.id)
    step(4)
    if (abandoned()) return false

    const pages = graph.getPages()
    preparation.update({
      phase: 'resolving-fonts',
      completed: 0,
      total: pages.length,
      unit: 'pages'
    })
    for (const [index, page] of pages.entries()) {
      await store.loadFontsForNodes(page.childIds)
      if (abandoned()) return false
      preparation.update({
        phase: 'resolving-fonts',
        completed: index + 1,
        total: pages.length,
        unit: 'pages'
      })
    }

    preparation.update({ phase: 'layout' })
    await yieldToUI()
    for (const page of pages) computeAllLayouts(graph, page.id)
    if (abandoned()) return false

    store.undo.clear()
    fitDemoPagesOnFirstVisit(
      store,
      graph.getPages().map((page) => page.id)
    )
    await store.switchPage(state.initialPageId, { preparation })
    if (abandoned()) return false

    store.clearSelection()
    store.zoomToFit()
    preparation.update({ phase: 'preparing-render' })
    store.requestRender()
    await store.preparationController.waitForPresentation(preparation.id, store.state.sceneVersion)
    return true
  }

  return { graph, state, run }
}

export async function createDemoShapes(store: EditorStore) {
  const preparation = store.preparationController.begin({
    kind: 'demo-load',
    phase: 'materializing'
  })
  const build = createDemoBuild(store, preparation)
  try {
    if (await build.run()) {
      preparation.complete()
      return
    }
  } catch (error) {
    reportDemoFailure(preparation, error)
  }
  rollbackBuild(store, build.graph, build.state)
  // A failed or superseded handle has already cleared itself, so this is a no-op then.
  preparation.cancel('superseded')
}
