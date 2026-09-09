import { createFigDocumentSession, type FigSessionCheckpoint } from '@open-pencil/fig'
import type { SceneGraph } from '@open-pencil/scene-graph'

interface RecoveryState {
  bytes: ArrayBuffer
  checkpoint: FigSessionCheckpoint
  session?: ReturnType<typeof createFigDocumentSession>
}
const states = new WeakMap<SceneGraph, RecoveryState>()

export function registerReaderRecovery(
  graph: SceneGraph,
  bytes: ArrayBuffer,
  checkpoint: FigSessionCheckpoint
): void {
  states.set(graph, { bytes, checkpoint })
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
  state.session ??= createFigDocumentSession(
    state.bytes,
    { derivedBounds: true },
    { graph, checkpoint: state.checkpoint }
  )
  const page = state.session.pages.find((page) => state.session?.graphPageId(page.id) === pageId)
  if (!page) throw new Error(`Unknown graph page ${pageId}`)
  const populated = !state.session.loadedPageIds.has(page.id)
  state.session.loadPage(page.id)
  return populated
}
