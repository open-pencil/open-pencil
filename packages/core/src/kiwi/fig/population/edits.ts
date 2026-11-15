import { isEqual } from 'es-toolkit/predicate'

import type { SceneGraph, SceneNode, Variable, VariableCollection } from '@open-pencil/scene-graph'

import { settingsSnapshot, type SettingsSnapshot } from '#core/kiwi/fig/session/archive/changes'

/**
 * What edits on the main thread changed since the last batch, as the main thread now has it, for
 * the reader worker's copy of the graph: pages keep loading there after the document is edited.
 */
export interface FigGraphEdits {
  revision: number
  /** Whole copies of the layers added or changed, with their ancestors below the page. */
  nodes: SceneNode[]
  /** Layers the main thread no longer has. */
  removed: string[]
  /** A variable or collection the main thread no longer has is null. */
  variables: Array<[string, Variable | null]>
  collections: Array<[string, VariableCollection | null]>
  settings?: SettingsSnapshot
}

export interface FigGraphEditTracker {
  /** The revision of the last batch sent, after sending what is pending. */
  readonly revision: number
  /** Sends what changed since the last batch, if anything did. */
  flush(): void
  /** Layers changed in batches after `revision`, including those sent with `send`. */
  changedSince(revision: number): Set<string>
  /** Forgets the layers of batches up to `revision`, which no page load is waiting on. */
  forget(revision: number): void
  /** Writes `fn` makes are the worker's own, such as a page it loaded, and are not sent. */
  ignoring<T>(fn: () => T): T
  /** Sends the main thread's state of `ids` in the next batch, as an edit would. */
  send(ids: Iterable<string>): void
  stop(): void
}

/** The page under the document holds no override maps an edit writes into in place. */
function withAncestorsBelowPage(graph: SceneGraph, ids: Iterable<string>): Set<string> {
  const result = new Set<string>()
  for (const id of ids) {
    result.add(id)
    let parentId = graph.getNode(id)?.parentId
    while (parentId && !result.has(parentId)) {
      const parent = graph.getNode(parentId)
      if (!parent || parent.type === 'CANVAS' || parent.id === graph.rootId) break
      result.add(parentId)
      parentId = parent.parentId
    }
  }
  return result
}

function depthOf(graph: SceneGraph, node: SceneNode): number {
  let depth = 0
  let parentId = node.parentId
  while (parentId) {
    depth++
    parentId = graph.getNode(parentId)?.parentId ?? null
  }
  return depth
}

/**
 * Sends `graph`'s edits to the reader worker as they happen, once per task. Layout a page gets
 * as it loads or as its fonts arrive is not sent: the worker's copy never had it, and it reaches
 * every layer of a page. Layout an edit causes is, as it is part of the edit.
 */
export function trackFigGraphEdits(
  graph: SceneGraph,
  post: (edits: FigGraphEdits) => void
): FigGraphEditTracker {
  let revision = 0
  let ignored = 0
  let scheduled = false
  let settings = settingsSnapshot(graph)
  const pendingNodes = new Set<string>()
  const pendingVariables = new Set<string>()
  const pendingCollections = new Set<string>()
  const sent: Array<{ revision: number; ids: Set<string> }> = []
  const skip = () => ignored > 0 || graph.isApplyingDerivedLayout

  function schedule() {
    if (scheduled) return
    scheduled = true
    queueMicrotask(flush)
  }

  function flush() {
    scheduled = false
    const nextSettings = settingsSnapshot(graph)
    const settingsChanged = !isEqual(settings, nextSettings)
    if (
      pendingNodes.size === 0 &&
      pendingVariables.size === 0 &&
      pendingCollections.size === 0 &&
      !settingsChanged
    ) {
      return
    }
    const ids = withAncestorsBelowPage(graph, pendingNodes)
    const nodes: SceneNode[] = []
    const removed: string[] = []
    for (const id of ids) {
      const node = graph.getNode(id)
      if (node) nodes.push(node)
      else removed.push(id)
    }
    // A parent is added before the layers in it.
    const depths = new Map(nodes.map((node) => [node.id, depthOf(graph, node)]))
    nodes.sort((a, b) => (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0))
    revision++
    post({
      revision,
      nodes,
      removed,
      variables: [...pendingVariables].map((id) => [id, graph.variables.get(id) ?? null]),
      collections: [...pendingCollections].map((id) => [
        id,
        graph.variableCollections.get(id) ?? null
      ]),
      ...(settingsChanged ? { settings: nextSettings } : {})
    })
    settings = nextSettings
    sent.push({ revision, ids })
    pendingNodes.clear()
    pendingVariables.clear()
    pendingCollections.clear()
  }

  const touch = (id: string) => {
    if (skip()) return
    pendingNodes.add(id)
    schedule()
  }
  const stop = graph.observeNodeChanges({
    before: (node) => touch(node.id),
    created: (node) => touch(node.id),
    beforeRecord: (kind, id) => {
      if (skip()) return
      if (kind === 'variable') pendingVariables.add(id)
      else pendingCollections.add(id)
      schedule()
    }
  })

  return {
    get revision() {
      flush()
      return revision
    },
    flush,
    changedSince(since) {
      const changed = new Set<string>()
      for (const batch of sent) {
        if (batch.revision <= since) continue
        for (const id of batch.ids) changed.add(id)
      }
      return changed
    },
    forget(through) {
      while (sent.length > 0 && sent[0].revision <= through) sent.shift()
    },
    ignoring(fn) {
      ignored++
      try {
        return fn()
      } finally {
        ignored--
      }
    },
    send(ids) {
      for (const id of ids) pendingNodes.add(id)
      if (pendingNodes.size > 0) schedule()
    },
    stop
  }
}

/**
 * Brings the reader worker's graph to the main thread's state of what `edits` changed. They are
 * edits there too, so pages that load afterwards reconcile their instances with them, as a page
 * loading into an edited graph does on the main thread.
 */
export function applyFigGraphEdits(graph: SceneGraph, edits: FigGraphEdits): void {
  graph.preserveSourceMetadataDuring(() => {
    for (const node of edits.nodes) {
      const current = graph.getNode(node.id)
      if (!current) {
        graph.createNodeWithId(node.id, node.type, node.parentId, node)
        continue
      }
      const absent = (Object.keys(current) as (keyof SceneNode)[]).filter((key) => !(key in node))
      graph.restoreNodeProperties(node.id, node, absent)
    }
    // A layer moved out of a removed one is already where the main thread has it; every removed
    // layer drops such links before any is removed, since removing one removes what it holds.
    for (const id of edits.removed) {
      const node = graph.getNode(id)
      if (!node) continue
      const stillInside = node.childIds.filter((childId) => graph.getNode(childId)?.parentId === id)
      if (stillInside.length !== node.childIds.length) {
        graph.restoreNodeProperties(id, { childIds: stillInside }, [])
      }
    }
    for (const id of edits.removed) graph.deleteNode(id)
    for (const [id, variable] of edits.variables) {
      graph.willChangeVariable(id)
      if (variable) graph.variables.set(id, variable)
      else graph.variables.delete(id)
    }
    for (const [id, collection] of edits.collections) {
      graph.willChangeCollection(id)
      if (collection) graph.variableCollections.set(id, collection)
      else graph.variableCollections.delete(id)
    }
    if (edits.settings) {
      graph.documentColorSpace = edits.settings.colorSpace
      graph.documentKind = edits.settings.kind
      graph.enabledLibraries = new Map(edits.settings.libraries)
    }
  })
}
