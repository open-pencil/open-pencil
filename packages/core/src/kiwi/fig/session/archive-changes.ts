import { isEqual } from 'es-toolkit/predicate'

import type { SceneGraph } from '@open-pencil/scene-graph'

/**
 * How a document opened from a `.fig` archive has diverged from it, for writing only what
 * changed. Layers loading from the archive are not changes, nor is the layout a page gets as
 * it loads or as its fonts arrive; the layout an edit causes is, since it moves the layers
 * around the edit.
 */
interface ArchiveChanges {
  touched: Set<string>
  /** The variables, collections and modes the archive holds. */
  resourceIds: Set<string>
  variables: Map<string, unknown>
  collections: unknown
  settings: unknown
}

const changes = new WeakMap<SceneGraph, ArchiveChanges>()

function settingsSnapshot(graph: SceneGraph): unknown {
  return structuredClone({
    colorSpace: graph.documentColorSpace,
    libraries: [...graph.enabledLibraries]
  })
}

function collectionsSnapshot(graph: SceneGraph): unknown {
  return structuredClone({
    collections: [...graph.variableCollections],
    activeMode: [...graph.activeMode]
  })
}

function resourceIdsOf(graph: SceneGraph): Set<string> {
  const ids = new Set(graph.variables.keys())
  for (const [id, collection] of graph.variableCollections) {
    ids.add(id)
    for (const mode of collection.modes) ids.add(mode.modeId)
  }
  return ids
}

export function trackArchiveChanges(graph: SceneGraph): void {
  const entry: ArchiveChanges = {
    touched: new Set(),
    resourceIds: resourceIdsOf(graph),
    variables: new Map(
      [...graph.variables].map(([id, variable]) => [id, structuredClone(variable)])
    ),
    collections: collectionsSnapshot(graph),
    settings: settingsSnapshot(graph)
  }
  const touch = (id: string) => {
    if (!graph.isApplyingImportedState && !graph.isApplyingDerivedLayout) entry.touched.add(id)
  }
  graph.onNodeEvents({
    created: (node) => touch(node.id),
    updated: touch,
    reparented: touch,
    reordered: touch,
    // A removed layer has no record of its own to write: the instance or component holding it
    // changes, and the parent leads there.
    deleted: (_id, parentId) => {
      if (parentId) touch(parentId)
    }
  })
  changes.set(graph, entry)
}

export interface ArchiveChangeSummary {
  /**
   * Layers created, updated or moved since the archive opened, and the parents of layers
   * removed; some may be gone since.
   */
  touched: ReadonlySet<string>
  resourceIds: ReadonlySet<string>
  /** Variables whose value, binding or presence changed. */
  changedVariables: ReadonlySet<string>
  collectionsChanged: boolean
  documentChanged: boolean
}

export function archiveChanges(graph: SceneGraph): ArchiveChangeSummary | undefined {
  const entry = changes.get(graph)
  if (!entry) return undefined
  const changedVariables = new Set<string>()
  for (const [id, variable] of graph.variables)
    if (!isEqual(entry.variables.get(id), variable)) changedVariables.add(id)
  for (const id of entry.variables.keys()) if (!graph.variables.has(id)) changedVariables.add(id)
  return {
    touched: entry.touched,
    resourceIds: entry.resourceIds,
    changedVariables,
    collectionsChanged: !isEqual(entry.collections, collectionsSnapshot(graph)),
    documentChanged: !isEqual(entry.settings, settingsSnapshot(graph))
  }
}
