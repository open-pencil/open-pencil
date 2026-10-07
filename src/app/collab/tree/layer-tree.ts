import {
  compareSiblings,
  rankedEdges,
  topEdge,
  type ParentEdge,
  type ParentEntries
} from './entries'

/**
 * The layer tree a shared document describes, resolved the same way on every peer.
 *
 * Each layer records every parent it has been moved under with a move counter (`ParentEntries`)
 * and an order key among its siblings. Following Evan Wallace's mutable tree hierarchy CRDT
 * (https://madebyevan.com/algos/crdt-mutable-tree-hierarchy/), a layer sits under the parent with
 * the highest counter, ties broken by parent id. When concurrent moves close a loop, the layer in
 * the loop whose placement has the highest (counter, layer id) — the latest move — falls back to
 * its next entry, until no loop is left. A layer none of whose parents exist, or can take it
 * without a loop, goes where `orphanParentOf` says: its page. Siblings sort by (order key, id).
 *
 * The resolved tree is a function of the entries alone, so peers that hold the same entries hold
 * the same tree whatever order the changes reached them in. Resolution is incremental: it
 * revisits only the layers that changed, lost a parent, or sit somewhere other than their newest
 * entry.
 */
export interface LayerTreeOptions {
  /** Where a layer that no recorded parent can take goes, or null to leave it out of the tree. */
  orphanParentOf(layerId: string): string | null
}

/** A layer whose resolved parent changed; `from` is undefined for a layer new to the tree. */
export interface TreeMove {
  layerId: string
  from: string | null | undefined
  to: string | null
}

interface TreeLayer {
  entries: ParentEntries
  orderKey: string | undefined
}

/** Marks the walk state of a layer while looking for loops. */
const ON_PATH = 1
const SETTLED = 2

export class LayerTree {
  private readonly layers = new Map<string, TreeLayer>()
  private readonly resolved = new Map<string, string | null>()
  private readonly children = new Map<string, Set<string>>()
  /** Layers that sit somewhere other than their newest entry, so a change can move them back. */
  private readonly displaced = new Set<string>()
  private readonly pending = new Set<string>()
  private highestCounter = 0

  constructor(private readonly options: LayerTreeOptions) {}

  has(layerId: string): boolean {
    return this.layers.has(layerId)
  }

  get size(): number {
    return this.layers.size
  }

  /** The highest move counter any layer's entries hold. */
  get maxCounter(): number {
    return this.highestCounter
  }

  entriesOf(layerId: string): ParentEntries | undefined {
    return this.layers.get(layerId)?.entries
  }

  orderKeyOf(layerId: string): string | undefined {
    return this.layers.get(layerId)?.orderKey
  }

  /** The resolved parent: null for the root, undefined for a layer the tree does not hold. */
  parentOf(layerId: string): string | null | undefined {
    return this.resolved.get(layerId)
  }

  /** A parent's children by (order key, id). */
  childrenOf(parentId: string): string[] {
    return [...(this.children.get(parentId) ?? [])]
      .map((id) => ({ id, orderKey: this.layers.get(id)?.orderKey }))
      .sort(compareSiblings)
      .map((child) => child.id)
  }

  /** Whether the layer sits somewhere other than its newest entry. */
  isDisplaced(layerId: string): boolean {
    return this.displaced.has(layerId)
  }

  /**
   * Displaced layers on the paths from `startIds` to the root. A move re-records their current
   * parent with a new counter, so it cannot pull a layer back into a parent it was kept out of.
   */
  displacedAncestors(startIds: Iterable<string | null | undefined>): string[] {
    const found = new Set<string>()
    const visited = new Set<string>()
    for (const start of startIds) {
      for (let id = start; id != null && !visited.has(id); id = this.resolved.get(id)) {
        visited.add(id)
        if (this.displaced.has(id)) found.add(id)
      }
    }
    return [...found]
  }

  /** Records a layer's shared entries and order key; `resolve` places it. */
  setLayer(layerId: string, entries: ParentEntries, orderKey: string | undefined): void {
    this.layers.set(layerId, { entries, orderKey })
    for (const counter of entries.values()) this.noteCounter(counter)
    this.pending.add(layerId)
  }

  setOrderKey(layerId: string, orderKey: string): void {
    const layer = this.layers.get(layerId)
    if (layer) layer.orderKey = orderKey
  }

  /**
   * Records a move this peer made: the layer is already under `parentId`, and `counter` is newer
   * than every entry the layer has, so the resolution agrees without revisiting it.
   */
  placeLocally(layerId: string, parentId: string, counter: number): void {
    const layer = this.layers.get(layerId)
    const entries = new Map(layer?.entries)
    entries.set(parentId, counter)
    this.layers.set(layerId, { entries, orderKey: layer?.orderKey })
    this.noteCounter(counter)
    this.place(layerId, parentId)
    this.updateDisplaced(layerId)
  }

  /** Removes a layer; its children are placed again on the next `resolve`. */
  deleteLayer(layerId: string): void {
    if (!this.layers.delete(layerId)) return
    for (const childId of this.children.get(layerId) ?? []) this.pending.add(childId)
    this.children.delete(layerId)
    this.unplace(layerId)
    this.resolved.delete(layerId)
    this.displaced.delete(layerId)
    this.pending.delete(layerId)
  }

  /** Places every layer changed since the last call and returns the layers that moved. */
  resolve(): TreeMove[] {
    const work = new Set<string>()
    for (const id of this.pending) if (this.layers.has(id)) work.add(id)
    for (const id of this.displaced) work.add(id)
    this.pending.clear()

    const assignment = this.assign(work)
    const moves: TreeMove[] = []
    for (const [id, to] of assignment) {
      const from = this.resolved.get(id)
      if (from !== to || !this.resolved.has(id)) {
        this.place(id, to)
        moves.push({ layerId: id, from, to })
      }
      this.updateDisplaced(id)
    }
    return moves
  }

  /**
   * Starts every layer in `work` at its newest valid entry and drops the latest placement in each
   * loop until none is left. Layers outside `work` sit at their newest entry already, so a loop
   * always runs through a layer in `work`, and the outcome does not depend on visiting order.
   */
  private assign(work: Set<string>): Map<string, string | null> {
    const ranked = new Map<string, ParentEdge[]>()
    const choice = new Map<string, number>()
    const assigned = new Map<string, string | null>()
    const counters = new Map<string, number>()

    const assignOne = (id: string) => {
      const entries = this.layers.get(id)?.entries ?? new Map<string, number>()
      let edges = ranked.get(id)
      if (!edges) {
        edges = rankedEdges(entries).filter(
          (edge) => edge.parentId !== id && this.layers.has(edge.parentId)
        )
        ranked.set(id, edges)
      }
      const index = choice.get(id) ?? 0
      const edge = edges.at(index)
      if (edge) {
        assigned.set(id, edge.parentId)
        counters.set(id, edge.counter)
      } else if (entries.size === 0) {
        assigned.set(id, null)
        counters.set(id, -1)
      } else {
        // Past the orphan placement there is nowhere left; leave the layer out of the tree.
        assigned.set(id, index === edges.length ? this.options.orphanParentOf(id) : null)
        counters.set(id, -1)
      }
    }

    for (const id of work) assignOne(id)
    const parentOf = (id: string) => (assigned.has(id) ? assigned.get(id) : this.resolved.get(id))

    for (let loops = this.findLoops(work, parentOf); loops.length;) {
      for (const loop of loops) {
        for (const id of loop) {
          if (work.has(id)) continue
          work.add(id)
          assignOne(id)
        }
        const latest = loop.reduce((a, b) => (isLater(b, a, counters) ? b : a))
        choice.set(latest, (choice.get(latest) ?? 0) + 1)
        assignOne(latest)
      }
      loops = this.findLoops(work, parentOf)
    }
    return assigned
  }

  /** The loops the parents of `starts` run into, each listed once. */
  private findLoops(
    starts: Iterable<string>,
    parentOf: (id: string) => string | null | undefined
  ): string[][] {
    const state = new Map<string, number>()
    const loops: string[][] = []
    for (const start of starts) {
      const path: string[] = []
      let id: string | null | undefined = start
      while (id != null && !state.has(id) && this.layers.has(id)) {
        state.set(id, ON_PATH)
        path.push(id)
        id = parentOf(id)
      }
      if (id != null && state.get(id) === ON_PATH) loops.push(path.slice(path.indexOf(id)))
      for (const visited of path) state.set(visited, SETTLED)
    }
    return loops
  }

  private place(layerId: string, parentId: string | null): void {
    this.unplace(layerId)
    this.resolved.set(layerId, parentId)
    if (parentId === null) return
    let siblings = this.children.get(parentId)
    if (!siblings) {
      siblings = new Set()
      this.children.set(parentId, siblings)
    }
    siblings.add(layerId)
  }

  private unplace(layerId: string): void {
    const previous = this.resolved.get(layerId)
    if (previous != null) this.children.get(previous)?.delete(layerId)
  }

  private updateDisplaced(layerId: string): void {
    const entries = this.layers.get(layerId)?.entries
    const newest = entries ? (topEdge(entries)?.parentId ?? null) : null
    if (this.resolved.get(layerId) === newest) this.displaced.delete(layerId)
    else this.displaced.add(layerId)
  }

  private noteCounter(counter: number): void {
    if (counter > this.highestCounter) this.highestCounter = counter
  }
}

/** Whether `a`'s placement is later than `b`'s: higher counter, then higher layer id. */
function isLater(a: string, b: string, counters: ReadonlyMap<string, number>): boolean {
  const counterA = counters.get(a) ?? -1
  const counterB = counters.get(b) ?? -1
  return counterA === counterB ? a > b : counterA > counterB
}
