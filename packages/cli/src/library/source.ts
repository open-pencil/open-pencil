import {
  createLibraryRevision,
  ensureLibraryAssetKeys,
  type ComponentLibraryRevision
} from '@open-pencil/core/library'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { remapInstanceOverrideState } from '@open-pencil/scene-graph/instances/overrides'

/** The document's variable for each source variable of the same name. */
export interface VariableMatch {
  variable: (id: string) => string
  unmatched: Set<string>
}

/**
 * The revision a library's source document makes. Without a previous revision its ID follows
 * the content alone, so the same source always makes the same revision.
 */
export function libraryRevision(
  source: SceneGraph,
  libraryId: string
): Promise<ComponentLibraryRevision> {
  ensureLibraryAssetKeys(source)
  return createLibraryRevision({ libraryId, name: libraryId, graph: source })
}

export function definitionRoots(graph: SceneGraph, libraryId: string): SceneNode[] {
  return graph
    .getPages(true)
    .filter((page) => page.internalOnly)
    .flatMap((page) => graph.getChildren(page.id))
    .filter((node) => node.librarySource?.identity.libraryId === libraryId)
}

export function subtree(graph: SceneGraph, rootId: string): Set<string> {
  const ids = new Set<string>()
  const queue = [rootId]
  for (const id of queue) {
    ids.add(id)
    queue.push(...(graph.getNode(id)?.childIds ?? []))
  }
  return ids
}

export function matchVariablesByName(graph: SceneGraph, source: SceneGraph): VariableMatch {
  const names = new Map(
    [...source.variables.values()].map((variable) => [variable.id, variable.name])
  )
  const ids = new Map([...graph.variables.values()].map((variable) => [variable.name, variable.id]))
  const unmatched = new Set<string>()
  return {
    unmatched,
    variable: (id) => {
      const name = names.get(id)
      const local = name ? ids.get(name) : undefined
      if (!local && name) unmatched.add(name)
      return local ?? id
    }
  }
}

/** Binds the revision's definitions to the document's variables `match` gives. */
export function bindVariables(
  graph: SceneGraph,
  revision: ComponentLibraryRevision,
  { variable }: VariableMatch
): void {
  for (const root of definitionRoots(graph, revision.manifest.libraryId)) {
    if (root.librarySource?.identity.revisionId !== revision.manifest.revisionId) continue
    for (const id of subtree(graph, root.id)) {
      const node = graph.getNode(id)
      if (!node) continue
      graph.updateNode(id, {
        boundVariables: Object.fromEntries(
          Object.entries(node.boundVariables).map(([field, bound]) => [field, variable(bound)])
        ),
        instanceOverrides: remapInstanceOverrideState(node.instanceOverrides, {
          node: (ref) => ref,
          variable
        })
      })
    }
  }
}
