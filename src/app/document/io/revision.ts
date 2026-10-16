import type { SceneGraph } from '@open-pencil/scene-graph'

interface LoadedRevision {
  file: File
  digest?: Promise<string>
  unchanged: boolean
}

const revisions = new WeakMap<SceneGraph, LoadedRevision>()

/** Hash the exact input archive; a later save is not the revision that was opened. */
export function rememberLoadedRevision(graph: SceneGraph, file: File): void {
  const revision: LoadedRevision = {
    file,
    unchanged: true
  }
  revisions.set(graph, revision)
  const changed = () => {
    if (!graph.isApplyingImportedState && !graph.isApplyingLayout) revision.unchanged = false
  }
  graph.onNodeEvents({
    created: changed,
    updated: changed,
    deleted: changed,
    reparented: changed,
    reordered: changed
  })
}

/** The input hash is usable only while pristine; callers also guard editor dirty/live state. */
export async function matchesLoadedRevision(graph: SceneGraph, expected: string): Promise<boolean> {
  const revision = revisions.get(graph)
  if (!revision || !revision.unchanged) return false
  revision.digest ??= revision.file.arrayBuffer().then(async (bytes) => {
    const hash = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
  })
  const digest = await revision.digest
  return (
    revisions.get(graph) === revision && hasUnchangedLoadedRevision(graph) && digest === expected
  )
}

/** A save after a content edit cannot keep claiming the original archive's revision. */
export function invalidateLoadedRevision(graph: SceneGraph): void {
  const revision = revisions.get(graph)
  if (revision) revision.unchanged = false
}

export function loadedFigFileName(graph: SceneGraph): string | undefined {
  return revisions.get(graph)?.file.name
}

export function hasUnchangedLoadedRevision(graph: SceneGraph): boolean {
  return revisions.get(graph)?.unchanged ?? false
}
