import { createFigDocumentSession, type FigSessionCheckpoint } from '@open-pencil/fig'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { readerSessionOptions, type FigReaderDiagnostic } from '#core/kiwi/fig/session/options'

interface RecoveryState {
  bytes: ArrayBuffer
  checkpoint?: FigSessionCheckpoint
  session?: ReturnType<typeof createFigDocumentSession>
  /** Records skipped by sessions this recovery state has opened. */
  diagnostics: FigReaderDiagnostic[]
}
const states = new WeakMap<SceneGraph, RecoveryState>()

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
  if (!state) return false
  const checkpoint = state.session?.checkpoint() ?? state.checkpoint
  const sourceId = checkpoint?.sources.find(([, graphId]) => graphId === pageId)?.[0]
  if (!sourceId) return false
  const session = state.session
  return session
    ? session.pages.some((page) => page.id === sourceId) && !session.loadedPageIds.has(sourceId)
    : !checkpoint.loadedPageIds.includes(sourceId)
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

export function populateReaderExport(source: SceneGraph, target: SceneGraph): boolean {
  const state = states.get(source)
  if (!state) return false
  const checkpoint = state.session?.checkpoint() ?? state.checkpoint
  if (!checkpoint) throw new Error('Missing replacement reader checkpoint')
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
  if (!state) throw new Error('No replacement reader recovery state')
  if (!state.session) {
    if (!state.checkpoint) throw new Error('Missing replacement reader checkpoint')
    state.session = createFigDocumentSession(state.bytes, readerSessionOptions(state.diagnostics), {
      graph,
      checkpoint: state.checkpoint
    })
  }
  const page = state.session.pages.find((page) => state.session?.graphPageId(page.id) === pageId)
  if (!page) throw new Error(`Unknown graph page ${pageId}`)
  const populated = !state.session.loadedPageIds.has(page.id)
  state.session.loadPage(page.id)
  return populated
}
