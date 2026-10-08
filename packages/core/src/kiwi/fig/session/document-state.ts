import { createFigDocumentSession, type FigSessionCheckpoint } from '@open-pencil/fig'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { readerSessionOptions, type FigReaderDiagnostic } from '#core/kiwi/fig/session/options'

/**
 * Per-graph reader state: the archive bytes, the live session or its checkpoint, and the
 * records that session skipped. Page population, diagnostics and recovery all read it.
 */
interface ReaderState {
  /** The archive, until every page is in the graph and nothing is left to read from it. */
  bytes?: ArrayBuffer
  checkpoint?: FigSessionCheckpoint
  session?: ReturnType<typeof createFigDocumentSession>
  /** Records skipped by sessions this recovery state has opened. */
  diagnostics: FigReaderDiagnostic[]
  /** Every page is loaded and the reader released; only the diagnostics remain. */
  complete?: true
}
const states = new WeakMap<SceneGraph, ReaderState>()

export function registerReaderRecovery(
  graph: SceneGraph,
  bytes: ArrayBuffer,
  checkpoint: FigSessionCheckpoint
): void {
  states.set(graph, { bytes, checkpoint, diagnostics: [] })
}

export function registerReaderSession(
  bytes: ArrayBuffer,
  session: ReturnType<typeof createFigDocumentSession>,
  diagnostics: FigReaderDiagnostic[] = []
): void {
  states.set(session.graph, { bytes, session, diagnostics })
}

/** Records skipped while opening, recovering, or exporting this graph's document. */
export function readerDiagnostics(graph: SceneGraph): readonly FigReaderDiagnostic[] {
  return states.get(graph)?.diagnostics ?? []
}

export function isReaderPagePending(graph: SceneGraph, pageId: string): boolean {
  const state = states.get(graph)
  if (!state || state.complete) return false
  const checkpoint = state.session?.checkpoint() ?? state.checkpoint
  const sourceId = checkpoint?.sources.find(([, graphId]) => graphId === pageId)?.[0]
  if (!sourceId) return false
  const session = state.session
  return session
    ? session.pages.some((page) => page.id === sourceId) && !session.loadedPageIds.has(sourceId)
    : !checkpoint.loadedPageIds.includes(sourceId)
}

/** Where the reader stands: which records became which layers, and which pages it loaded. */
export function readerCheckpoint(graph: SceneGraph): FigSessionCheckpoint | undefined {
  const state = states.get(graph)
  return state?.session?.checkpoint() ?? state?.checkpoint
}

export function hasReaderSession(graph: SceneGraph): boolean {
  return states.has(graph)
}

export function populateFigPage(graph: SceneGraph, pageId: string): boolean {
  return isReaderPagePending(graph, pageId) ? recoverReaderPage(graph, pageId) : false
}

export function populateAllFigPages(graph: SceneGraph): boolean {
  let changed = false
  for (const page of graph.getPages()) {
    if (populateFigPage(graph, page.id)) changed = true
  }
  return changed
}

/**
 * Drop the session and the archive once every page is in the graph, internal ones included, which
 * the first full save loads. The session keeps every record of the file decoded, which for a
 * large design kit is gigabytes, and no page is pending. The checkpoint stays: it says which
 * record each layer came from, which saving only the changed records still reads.
 */
function releaseLoadedReader(state: ReaderState): void {
  const session = state.session
  if (!session?.pages.every((page) => session.loadedPageIds.has(page.id))) return
  state.checkpoint = session.checkpoint()
  state.session = undefined
  state.bytes = undefined
  state.complete = true
}

/**
 * Load the pages the editor never shows, such as Figma's internal canvas, into the document's own
 * graph, so a save no longer opens a second session to read them into its copy. Their layers
 * never draw and loading them is not an edit. Only a live session loads them: while a population
 * worker still fills the graph, a second session must not, and the export reads them as before.
 */
export function populateFigInternalPages(graph: SceneGraph): boolean {
  const state = states.get(graph)
  const session = state?.session
  if (!state || !session) return false
  let changed = false
  for (const page of session.pages) {
    if (!page.internalOnly || session.loadedPageIds.has(page.id)) continue
    graph.applyImportedStateDuring(() => session.loadPage(page.id))
    changed = true
  }
  releaseLoadedReader(state)
  return changed
}

/**
 * Whether a save still has pages to read from the archive, which it reads into a copy of the
 * document: a population worker still fills the graph, or a page is not loaded yet.
 */
export function hasPendingReaderPages(graph: SceneGraph): boolean {
  const state = states.get(graph)
  if (!state || state.complete) return false
  const session = state.session
  return !session || !session.pages.every((page) => session.loadedPageIds.has(page.id))
}

export function populateReaderExport(source: SceneGraph, target: SceneGraph): boolean {
  const state = states.get(source)
  if (!state || state.complete) return false
  const live = state.session
  // Every page is already in the graph the target was copied from.
  if (live?.pages.every((page) => live.loadedPageIds.has(page.id))) return false
  const checkpoint = live?.checkpoint() ?? state.checkpoint
  if (!checkpoint || !state.bytes) throw new Error('Missing reader checkpoint')
  const session = createFigDocumentSession(state.bytes, readerSessionOptions(state.diagnostics), {
    graph: target,
    checkpoint
  })
  // Export must include internal content too, not just the dependency closure needed
  // for visible pages. Loading happens on the isolated target, never the live graph.
  for (const page of session.pages) session.loadPage(page.id)
  return true
}

export function updateReaderRecovery(graph: SceneGraph, checkpoint: FigSessionCheckpoint): void {
  const state = states.get(graph)
  if (state && !state.session) state.checkpoint = checkpoint
}

export function releaseReaderRecovery(graph: SceneGraph): void {
  states.delete(graph)
}

export function recoverReaderPage(graph: SceneGraph, pageId: string): boolean {
  const state = states.get(graph)
  if (!state) throw new Error('No reader recovery state')
  if (state.complete) return false
  if (!state.session) {
    if (!state.checkpoint || !state.bytes) throw new Error('Missing reader checkpoint')
    state.session = createFigDocumentSession(state.bytes, readerSessionOptions(state.diagnostics), {
      graph,
      checkpoint: state.checkpoint
    })
  }
  const page = state.session.pages.find((page) => state.session?.graphPageId(page.id) === pageId)
  if (!page) throw new Error(`Unknown graph page ${pageId}`)
  const session = state.session
  const populated = !session.loadedPageIds.has(page.id)
  // The layers come from the opened file, as they do through the population worker's delta.
  graph.applyImportedStateDuring(() => session.loadPage(page.id))
  releaseLoadedReader(state)
  return populated
}
