import type {
  FontResolutionDemand,
  FontResolutionListener,
  FontResolutionLoader,
  FontResolutionSettled,
  FontResolutionSnapshot
} from '#core/text/resolver/types'

interface FontResolutionEntry {
  demand: FontResolutionDemand
  snapshot: FontResolutionSnapshot
  promise: Promise<FontResolutionSnapshot>
  callbacks: Map<FontResolutionSettled, Set<string>>
  nodeIds: Set<string>
}

function idleSnapshot(key: string): FontResolutionSnapshot {
  return { key, state: 'idle' }
}

export class FontResolver {
  private readonly entries = new Map<string, FontResolutionEntry>()
  private readonly listeners = new Set<FontResolutionListener>()

  constructor(private readonly load: FontResolutionLoader) {}

  subscribe(listener: FontResolutionListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  state(demand: FontResolutionDemand | string): FontResolutionSnapshot {
    const key = typeof demand === 'string' ? demand : demand.key
    return this.entries.get(key)?.snapshot ?? idleSnapshot(key)
  }

  pendingNodeIds(demand: FontResolutionDemand | string): string[] {
    const key = typeof demand === 'string' ? demand : demand.key
    const entry = this.entries.get(key)
    return entry?.snapshot.state === 'loading' ? [...entry.nodeIds] : []
  }

  demand(
    demand: FontResolutionDemand,
    onSettled?: FontResolutionSettled
  ): Promise<FontResolutionSnapshot> {
    return this.request(demand, onSettled)
  }

  demandForNode(
    demand: FontResolutionDemand,
    nodeId: string,
    onSettled?: FontResolutionSettled
  ): Promise<FontResolutionSnapshot> {
    return this.request(demand, onSettled, nodeId)
  }

  retry(
    demand: FontResolutionDemand,
    onSettled?: FontResolutionSettled
  ): Promise<FontResolutionSnapshot> {
    if (this.state(demand).state !== 'failed') return this.demand(demand, onSettled)
    this.entries.delete(demand.key)
    return this.demand(demand, onSettled)
  }

  exhaust(demand: FontResolutionDemand): FontResolutionSnapshot {
    const current = this.entries.get(demand.key)
    if (current?.snapshot.state === 'loading') return current.snapshot
    const snapshot: FontResolutionSnapshot = { key: demand.key, state: 'exhausted' }
    if (current) {
      current.snapshot = snapshot
      current.promise = Promise.resolve(snapshot)
      current.callbacks.clear()
      current.nodeIds.clear()
      return snapshot
    }
    const entry: FontResolutionEntry = {
      demand,
      snapshot,
      promise: Promise.resolve(snapshot),
      callbacks: new Map(),
      nodeIds: new Set()
    }
    this.entries.set(demand.key, entry)
    return snapshot
  }

  reset(demand?: FontResolutionDemand | string): void {
    if (demand === undefined) {
      this.entries.clear()
      this.notify('reset', idleSnapshot('*'))
      return
    }
    const key = typeof demand === 'string' ? demand : demand.key
    this.entries.delete(key)
    this.notify('reset', idleSnapshot(key))
  }

  private request(
    demand: FontResolutionDemand,
    onSettled?: FontResolutionSettled,
    nodeId?: string
  ): Promise<FontResolutionSnapshot> {
    const current = this.entries.get(demand.key)
    if (current) {
      if (current.snapshot.state === 'loading') this.addConsumer(current, onSettled, nodeId)
      return current.promise
    }

    const snapshot: FontResolutionSnapshot = { key: demand.key, state: 'loading' }
    const entry: FontResolutionEntry = {
      demand,
      snapshot,
      callbacks: new Map(),
      nodeIds: new Set(),
      promise: Promise.resolve(snapshot)
    }
    this.addConsumer(entry, onSettled, nodeId)
    this.entries.set(demand.key, entry)
    this.notify('started', snapshot)
    entry.promise = this.resolve(entry)
    return entry.promise
  }

  private addConsumer(
    entry: FontResolutionEntry,
    onSettled?: FontResolutionSettled,
    nodeId?: string
  ): void {
    if (nodeId) entry.nodeIds.add(nodeId)
    if (!onSettled) return
    const callbackNodes = entry.callbacks.get(onSettled) ?? new Set<string>()
    if (nodeId) callbackNodes.add(nodeId)
    entry.callbacks.set(onSettled, callbackNodes)
  }

  private async resolve(entry: FontResolutionEntry): Promise<FontResolutionSnapshot> {
    for (const candidate of entry.demand.candidates) {
      if (this.entries.get(entry.demand.key) !== entry) return idleSnapshot(entry.demand.key)
      entry.snapshot = { key: entry.demand.key, state: 'loading', candidate }
      try {
        if (await this.load(candidate, entry.demand)) {
          return this.settle(entry, {
            key: entry.demand.key,
            state: 'loaded',
            candidate,
            source: candidate.source
          })
        }
      } catch (error) {
        return this.settle(entry, {
          key: entry.demand.key,
          state: 'failed',
          candidate,
          source: candidate.source,
          error
        })
      }
    }

    return this.settle(entry, { key: entry.demand.key, state: 'exhausted' })
  }

  private settle(
    entry: FontResolutionEntry,
    snapshot: FontResolutionSnapshot
  ): FontResolutionSnapshot {
    if (this.entries.get(entry.demand.key) !== entry) return idleSnapshot(entry.demand.key)
    entry.snapshot = snapshot
    this.notify('settled', snapshot)
    for (const [callback, nodeIds] of entry.callbacks) {
      try {
        callback(snapshot, [...nodeIds])
      } catch (error) {
        console.error('Font resolution callback failed:', error)
      }
    }
    entry.callbacks.clear()
    entry.nodeIds.clear()
    return snapshot
  }

  private notify(event: Parameters<FontResolutionListener>[0], snapshot: FontResolutionSnapshot) {
    for (const listener of this.listeners) listener(event, snapshot)
  }
}
