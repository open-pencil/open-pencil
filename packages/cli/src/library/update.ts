import {
  materializeLibraryAsset,
  planOutdatedLibraryInstances,
  updateLibraryDefinitions
} from '@open-pencil/core/library'
import type { SceneGraph } from '@open-pencil/scene-graph'

import {
  bindVariables,
  definitionRoots,
  libraryRevision,
  matchVariablesByName,
  subtree
} from '#cli/library/source'

export interface LibraryUpdateResult {
  libraryId: string
  revisionId: string
  /** Whether the document uses the library; one that does not is left as it is. */
  used: boolean
  /** Whether the document already showed this revision. */
  current: boolean
  /** Asset keys whose definitions now draw the revision, in place. */
  updatedDefinitions: string[]
  /** Instances moved to a definition the revision draws as another kind of layer. */
  updatedInstances: string[]
  materialized: number
  removedDefinitions: number
  /** Bindings to source variables the document has no variable of the same name for. */
  unmatchedVariables: string[]
}

export interface LibraryUpdateOptions {
  /** The library's ID; the document's only enabled library when omitted. */
  libraryId?: string
  /**
   * Binds the library's layers to the document's variables with the same names, since a
   * revision carries no variables; a document can then restyle the library with its tokens.
   */
  variablesByName?: boolean
}

/** Removes definitions of other revisions that no layer outside them points at any more. */
function removeUnusedDefinitions(graph: SceneGraph, libraryId: string, revisionId: string): number {
  let removed = 0
  for (let changed = true; changed;) {
    changed = false
    const referenced = new Set<string>()
    const stale = definitionRoots(graph, libraryId).filter(
      (root) => root.librarySource?.identity.revisionId !== revisionId
    )
    const inside = new Map(stale.map((root) => [root.id, subtree(graph, root.id)]))
    for (const node of graph.getAllNodes()) {
      if (!node.componentId) continue
      for (const [rootId, ids] of inside) {
        if (ids.has(node.componentId) && !ids.has(node.id)) referenced.add(rootId)
      }
    }
    for (const root of stale) {
      if (referenced.has(root.id)) continue
      graph.deleteNode(root.id)
      removed++
      changed = true
    }
  }
  return removed
}

/**
 * Brings a document's definitions of a library to the revision its source document makes,
 * without the app: each definition is redrawn in place, so its instances and their overrides
 * follow as they follow an edited component. A definition the revision draws as another kind of
 * layer is materialized anew for its instances to swap to, and definitions nothing uses any more
 * go.
 */
export async function updateLibraryFromSource(
  graph: SceneGraph,
  source: SceneGraph,
  { libraryId, variablesByName = false }: LibraryUpdateOptions = {}
): Promise<LibraryUpdateResult> {
  const enabled = [...graph.enabledLibraries.keys()]
  const id = libraryId ?? (enabled.length === 1 ? enabled[0] : undefined)
  if (!id) {
    throw new Error(
      enabled.length === 0
        ? 'The document uses no library'
        : `The document uses several libraries (${enabled.join(', ')}); choose one with --id`
    )
  }
  const previous = graph.enabledLibraries.get(id)
  const revision = await libraryRevision(source, id)
  const revisionId = revision.manifest.revisionId
  const result: LibraryUpdateResult = {
    libraryId: id,
    revisionId,
    used: previous !== undefined,
    current: previous?.revisionId === revisionId,
    updatedDefinitions: [],
    updatedInstances: [],
    materialized: 0,
    removedDefinitions: 0,
    unmatchedVariables: []
  }
  if (!result.used || result.current) return result

  const match = variablesByName ? matchVariablesByName(graph, source) : undefined
  const definitions = updateLibraryDefinitions(graph, revision, { variable: match?.variable })
  result.updatedDefinitions = definitions.updated
  for (const key of definitions.replaced) {
    if (materializeLibraryAsset(graph, revision, key).created) result.materialized++
  }
  if (match && definitions.replaced.length > 0) bindVariables(graph, revision, match)
  for (const plan of planOutdatedLibraryInstances(graph, revision)) {
    graph.swapInstanceComponent(plan.instanceId, plan.componentId)
    result.updatedInstances.push(plan.instanceId)
  }
  result.removedDefinitions = removeUnusedDefinitions(graph, id, revisionId)
  result.unmatchedVariables = match ? [...match.unmatched].sort() : []
  return result
}
