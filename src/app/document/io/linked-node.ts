import type { SceneGraph } from '@open-pencil/scene-graph'

import { hasUnchangedLoadedRevision, matchesLoadedRevision } from '@/app/document/io/revision'
import { focusNodeBySourceId, type FocusStore } from '@/app/editor/selection/focus'

export interface LinkedNodeIdentity {
  id: string
  file: string
  revision?: string
}

export type LinkedNodeResult = 'found' | 'missing' | 'ambiguous' | 'stale' | 'superseded'

export interface LinkedNodeStore extends FocusStore {
  graph: SceneGraph
  getSourceIdentity: () => { path: string | null }
  hasUnsavedChanges: () => boolean
  getStorageBinding: () => object | null
}

/** Keep pinned links on the exact loaded archive and respect the active tab's authority. */
export async function focusLinkedNode(
  store: LinkedNodeStore,
  target: LinkedNodeIdentity,
  isCurrent: () => boolean
): Promise<LinkedNodeResult> {
  const graph = store.graph
  const current = () =>
    isCurrent() && store.graph === graph && store.getSourceIdentity().path === target.file
  if (!current()) return 'superseded'
  if (target.revision) {
    if (store.hasUnsavedChanges() || store.getStorageBinding()) return 'stale'
    if (!(await matchesLoadedRevision(graph, target.revision))) return 'stale'
    if (!current()) return 'superseded'
    if (store.hasUnsavedChanges()) return 'stale'
  }
  const pristine = () =>
    !target.revision ||
    (!store.hasUnsavedChanges() && !store.getStorageBinding() && hasUnchangedLoadedRevision(graph))
  const result = await focusNodeBySourceId(store, target.id, () => current() && pristine())
  return current() && !pristine() ? 'stale' : result
}
