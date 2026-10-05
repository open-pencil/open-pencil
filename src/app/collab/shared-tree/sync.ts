import { isEqual } from 'es-toolkit/predicate'
import type * as Y from 'yjs'

import type { SceneGraph } from '@open-pencil/scene-graph'
import { siblingOrderKeys } from '@open-pencil/scene-graph/order-keys'

import { LayerTree, type TreeMove } from '@/app/collab/tree/layer-tree'

import {
  createMoveClock,
  markTreeFormat,
  randomKeySuffix,
  readOrderKey,
  readPage,
  readParentEntries,
  readRoot,
  writeOrderKey,
  writePage,
  writeParentEntry,
  type YMeta,
  type YNodes
} from './fields'

/** What one local edit changed, collected from graph events and written in one transaction. */
export interface LocalEdit {
  /** Layers whose own properties changed, or that were created. */
  changed: Set<string>
  /** Layers that moved or were reordered: their parent entry and order key are rewritten. */
  placed: Set<string>
  /** Parents whose child list was assigned directly, such as by a rollback. */
  reordered: Set<string>
  /** Parents layers left; displaced layers on their paths are re-recorded. */
  previousParents: Set<string>
  deleted: Set<string>
}

export function createLocalEdit(): LocalEdit {
  return {
    changed: new Set(),
    placed: new Set(),
    reordered: new Set(),
    previousParents: new Set(),
    deleted: new Set()
  }
}

export function isLocalEditEmpty(edit: LocalEdit): boolean {
  return Object.values(edit).every((ids: Set<string>) => ids.size === 0)
}

/** The resolved layer tree of one shared document, kept beside the scene graph it mirrors. */
export type SharedTree = ReturnType<typeof createSharedTree>

export function createSharedTree(
  ydoc: Y.Doc,
  getGraph: () => SceneGraph,
  getYnodes: () => YNodes | null
) {
  let rootId: string | null = null
  const clock = createMoveClock()
  const tree: LayerTree = new LayerTree({
    orphanParentOf(layerId: string): string | null {
      if (rootId === null || layerId === rootId) return null
      const root = rootId
      const graph = getGraph()
      if (graph.getNode(layerId)?.type === 'CANVAS') return root
      const isPage = (id: string) =>
        tree.parentOf(id) === root && graph.getNode(id)?.type === 'CANVAS'
      // The page the layer was last placed on; failing that, the first page in the shared
      // order, so every peer picks the same one.
      const ynode = getYnodes()?.get(layerId)
      const recorded = ynode ? readPage(ynode) : undefined
      if (recorded !== undefined && isPage(recorded)) return recorded
      return tree.childrenOf(root).find(isPage) ?? root
    }
  })
  return {
    ydoc,
    tree,
    clock,
    get rootId() {
      return rootId
    },
    setRoot(id: string) {
      rootId = id
    }
  }
}

/**
 * Writes where this peer put the layers an edit placed: a parent entry with a new counter for
 * each layer whose parent changed, the same for displaced layers on the paths the moves touched
 * (so a move cannot pull another layer back into a parent it was kept out of), the page of each
 * moved layer and of the layers under it, and order keys between each placed layer's
 * neighbours. Call inside the edit's transaction.
 */
export function writeLocalPlacement(
  shared: SharedTree,
  graph: SceneGraph,
  ynodes: YNodes,
  meta: YMeta,
  edit: LocalEdit
): void {
  const { moved, pathStarts } = findMoves(shared, graph, ynodes, edit)
  recordMoves(shared, graph, ynodes, meta, moved, pathStarts)
  writePages(graph, ynodes, moved)

  const keyed = new Set([...edit.placed, ...moved])
  const parents = new Set(edit.reordered)
  for (const id of keyed) {
    const parentId = graph.getNode(id)?.parentId
    if (parentId) parents.add(parentId)
  }
  for (const parentId of parents) writeSiblingKeys(shared.tree, graph, ynodes, parentId, keyed)
}

/** Layers the edit left under a parent other than the shared tree's, and the paths they touch. */
function findMoves(shared: SharedTree, graph: SceneGraph, ynodes: YNodes, edit: LocalEdit) {
  const { tree } = shared
  const candidates = new Set([...edit.placed, ...edit.changed])
  for (const parentId of edit.reordered) {
    for (const childId of graph.getNode(parentId)?.childIds ?? []) candidates.add(childId)
  }
  const moved: string[] = []
  const pathStarts: (string | null | undefined)[] = [...edit.previousParents]
  for (const id of candidates) {
    const parentId = graph.getNode(id)?.parentId
    if (!parentId || !ynodes.has(id)) continue
    if (!tree.has(id) || tree.parentOf(id) !== parentId) {
      moved.push(id)
      pathStarts.push(tree.parentOf(id), parentId)
    }
  }
  return { moved, pathStarts }
}

/**
 * Gives every moved layer a parent entry with one new counter, and re-records displaced layers
 * on the touched paths under their current parent, as Evan Wallace's algorithm does, so this
 * move cannot pull them back into a parent they were kept out of.
 */
function recordMoves(
  shared: SharedTree,
  graph: SceneGraph,
  ynodes: YNodes,
  meta: YMeta,
  moved: readonly string[],
  pathStarts: readonly (string | null | undefined)[]
): void {
  const { tree } = shared
  const movedIds = new Set(moved)
  const kept = tree.displacedAncestors(pathStarts).filter((id) => !movedIds.has(id))
  if (moved.length === 0 && kept.length === 0) return
  const counter = shared.clock.next(meta, tree.maxCounter)
  const placements = [
    ...kept.map((id) => [id, tree.parentOf(id)] as const),
    ...moved.map((id) => [id, graph.getNode(id)?.parentId] as const)
  ]
  for (const [id, parentId] of placements) {
    const ynode = ynodes.get(id)
    if (!parentId || !ynode) continue
    writeParentEntry(ynode, parentId, counter)
    tree.placeLocally(id, parentId, counter)
  }
  markTreeFormat(meta)
}

/** The page a layer sits on, or undefined for the root and the pages themselves. */
export function pageOf(graph: SceneGraph, layerId: string): string | undefined {
  if (graph.getNode(layerId)?.type === 'CANVAS') return undefined
  return graph.closest(layerId, (node) => node.type === 'CANVAS')?.id
}

/** Records the page of each moved layer and, when it changed, of every layer under it. */
function writePages(graph: SceneGraph, ynodes: YNodes, moved: readonly string[]): void {
  for (const id of moved) {
    const pageId = pageOf(graph, id)
    if (pageId === undefined) continue
    const stack = [id]
    for (let layerId = stack.pop(); layerId !== undefined; layerId = stack.pop()) {
      const ynode = ynodes.get(layerId)
      if (!ynode || readPage(ynode) === pageId) continue
      writePage(ynode, pageId)
      stack.push(...(graph.getNode(layerId)?.childIds ?? []))
    }
  }
}

/** Keys a parent's children in their local order, re-keying only the layers that need it. */
function writeSiblingKeys(
  tree: LayerTree,
  graph: SceneGraph,
  ynodes: YNodes,
  parentId: string,
  keyed: ReadonlySet<string>
): void {
  const children = (graph.getNode(parentId)?.childIds ?? []).filter(
    (id) => tree.parentOf(id) === parentId && ynodes.has(id)
  )
  const keys = siblingOrderKeys(
    children.map((id) => (keyed.has(id) ? undefined : tree.orderKeyOf(id))),
    { suffix: randomKeySuffix }
  )
  children.forEach((id, index) => {
    const key = keys[index]
    const ynode = ynodes.get(id)
    if (!ynode || tree.orderKeyOf(id) === key) return
    writeOrderKey(ynode, key)
    tree.setOrderKey(id, key)
  })
}

/**
 * Brings the scene graph to the tree the shared document describes after a change to the given
 * layers: records their entries and keys, resolves the tree, moves layers whose parent changed,
 * and sorts every parent the change touched by (order key, id). Moves go through
 * `insertChildAt`, so the graph's usual events fire.
 */
export function applySharedTree(
  shared: SharedTree,
  graph: SceneGraph,
  ynodes: YNodes,
  meta: YMeta,
  changed: Iterable<string>,
  deleted: Iterable<string>
): void {
  const { tree } = shared
  const touched = new Set<string>()
  const placed: string[] = []
  for (const id of changed) {
    const ynode = ynodes.get(id)
    const entries = ynode ? readParentEntries(ynode) : undefined
    if (!ynode || !entries || !graph.getNode(id)) continue
    const orderKey = readOrderKey(ynode)
    // Most changes edit a layer's own fields; its place and its siblings stay as they are.
    if (tree.has(id) && tree.orderKeyOf(id) === orderKey && isEqual(tree.entriesOf(id), entries)) {
      continue
    }
    const previousParent = tree.parentOf(id)
    if (previousParent) touched.add(previousParent)
    tree.setLayer(id, entries, orderKey)
    placed.push(id)
  }
  for (const id of deleted) tree.deleteLayer(id)
  adoptRoot(shared, graph, meta)

  // A second pass places layers whose page was itself placed in the first.
  const moves = [...tree.resolve(), ...tree.resolve()]
  applyMoves(graph, moves, touched)
  for (const id of placed) {
    const parentId = tree.parentOf(id)
    if (parentId) touched.add(parentId)
  }
  for (const parentId of touched) sortChildren(graph, tree, parentId)
}

/**
 * Removes the layers outside the room's tree from an edit, so they stay local: a peer that joined
 * a room keeps its own earlier document, which undo can still reach.
 */
export function keepSharedLayers(shared: SharedTree, graph: SceneGraph, edit: LocalEdit): void {
  const rootId = shared.rootId
  const isShared = (id: string) =>
    rootId !== null && graph.closest(id, (node) => node.id === rootId) !== undefined
  for (const ids of [edit.changed, edit.placed, edit.reordered, edit.previousParents]) {
    for (const id of ids) if (!isShared(id)) ids.delete(id)
  }
}

/** Records layers this peer wrote itself, such as when sharing its document. */
export function recordLocalLayers(
  shared: SharedTree,
  ynodes: YNodes,
  meta: YMeta,
  layerIds: Iterable<string>
) {
  for (const id of layerIds) {
    const ynode = ynodes.get(id)
    const entries = ynode ? readParentEntries(ynode) : undefined
    if (!ynode || !entries) continue
    shared.tree.setLayer(id, entries, readOrderKey(ynode))
  }
  const rootId = readRoot(meta)
  if (rootId !== undefined) shared.setRoot(rootId)
  shared.tree.resolve()
}

/**
 * Follows the root the room records. Layers under any other root, such as a joiner's own earlier
 * document, stay in the shared tree but out of the graph's pages.
 */
function adoptRoot(shared: SharedTree, graph: SceneGraph, meta: YMeta): void {
  const rootId = readRoot(meta)
  if (rootId === undefined || rootId === shared.rootId || !shared.tree.has(rootId)) return
  shared.setRoot(rootId)
  graph.rootId = rootId
}

function applyMoves(graph: SceneGraph, moves: TreeMove[], touched: Set<string>): void {
  const pending = new Map<string, string>()
  for (const move of moves) {
    if (move.to === null) pending.delete(move.layerId)
    else pending.set(move.layerId, move.to)
  }
  // The resolved tree has no loops, but reaching it can need one move before another.
  for (let progressed = true; progressed && pending.size > 0;) {
    progressed = false
    for (const [id, parentId] of pending) {
      const node = graph.getNode(id)
      const parent = graph.getNode(parentId)
      if (!node || !parent) {
        pending.delete(id)
        continue
      }
      if (node.parentId === parentId) {
        pending.delete(id)
        touched.add(parentId)
        continue
      }
      if (graph.isDescendant(parentId, id)) continue
      if (node.parentId) touched.add(node.parentId)
      touched.add(parentId)
      graph.insertChildAt(id, parentId, parent.childIds.length)
      pending.delete(id)
      progressed = true
    }
  }
}

function sortChildren(graph: SceneGraph, tree: LayerTree, parentId: string): void {
  const parent = graph.getNode(parentId)
  if (!parent) return
  const shared = tree.childrenOf(parentId).filter((id) => graph.getNode(id)?.parentId === parentId)
  const sharedIds = new Set(shared)
  const desired = [...shared, ...parent.childIds.filter((id) => !sharedIds.has(id))]
  desired.forEach((id, index) => {
    if (parent.childIds[index] !== id) graph.insertChildAt(id, parentId, index)
  })
}
