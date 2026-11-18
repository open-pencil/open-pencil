import {
  idOf,
  parentIdOf,
  terminalComponent,
  type InterpreterIndex,
  type SourceIndex
} from '../source-index'
import { subtree } from './references'

/** A component an expansion entered, and the record whose layer or default chose it. */
export interface ComponentChoice {
  ownerId: string
  componentId: string
}

export interface ComponentLoopSources {
  /** The document's records in layer order, as headers or whole; read for order and parents. */
  readonly order: SourceIndex
  /** Records from which a read could reach a loop, found as the document opened. */
  readonly reaching: () => ReadonlySet<string>
  /** Whole records for one repair, decoded for it and not kept once it is done. */
  readonly whole: () => InterpreterIndex
  /** The components a definition's expansion enters, with the record that chose each. */
  readonly discover: (
    index: InterpreterIndex,
    componentId: string,
    dropped: ReadonlySet<string>
  ) => ComponentChoice[]
}

export interface ComponentLoops {
  /**
   * Make sure no loop a read of the record could reach is left unrepaired, before the read
   * expands it. `report` hears of each instance a repair this call runs leaves out.
   */
  readonly ensure: (id: string, report?: (instanceId: string) => void) => void
  /** Instances left out of their definitions because their component would contain itself. */
  readonly dropped: () => ReadonlySet<string>
}

/** The document's outermost records: its document record first, then any other parentless one. */
function roots({ sources }: SourceIndex): string[] {
  const parentless: { id: string; document: boolean }[] = []
  for (const [id, record] of sources) {
    const parent = parentIdOf(record)
    if (parent === undefined || !sources.has(parent))
      parentless.push({ id, document: record.type === 'DOCUMENT' })
  }
  return [
    ...parentless.filter((root) => root.document),
    ...parentless.filter((root) => !root.document)
  ].map((root) => root.id)
}

/** The nearest component holding a record, the record included. */
function definitionOf({ sources }: SourceIndex, id: string): string | undefined {
  const seen = new Set<string>()
  for (let current: string | undefined = id; current !== undefined && !seen.has(current);) {
    seen.add(current)
    const record = sources.get(current)
    if (!record) return undefined
    if (record.type === 'SYMBOL') return current
    current = parentIdOf(record)
  }
  return undefined
}

/**
 * Figma's repair: it walks component definitions depth first, in layer order across the
 * document, and leaves out an instance whose choice in a definition leads back into one still
 * being walked. Only definitions that lead into a loop are walked, each with the choices its
 * expansion makes, so a swap whose layer is gone and an instance whose own swap replaces its
 * component count as they expand.
 */
function repair(sources: ComponentLoopSources): Set<string> {
  const index = sources.whole()
  const reaching = sources.reaching()
  const dropped = new Set<string>()
  const state = new Map<string, 'walking' | 'done'>()
  const walk = (componentId: string): void => {
    state.set(componentId, 'walking')
    const layer = new Map<string, number>()
    for (const record of subtree(sources.order, componentId)) {
      const id = idOf(record)
      if (id !== undefined) layer.set(id, layer.size)
    }
    const choices = sources
      .discover(index, componentId, dropped)
      .filter(({ ownerId }) => definitionOf(sources.order, ownerId) === componentId)
      .toSorted((a, b) => (layer.get(a.ownerId) ?? 0) - (layer.get(b.ownerId) ?? 0))
    for (const { ownerId, componentId: chosen } of choices) {
      if (dropped.has(ownerId)) continue
      const target = terminalComponent(index, chosen)
      const reached = state.get(target)
      if (reached === 'walking') dropped.add(ownerId)
      else if (reached === undefined && reaching.has(target)) walk(target)
    }
    state.set(componentId, 'done')
  }
  for (const root of roots(sources.order))
    for (const record of subtree(sources.order, root)) {
      const id = idOf(record)
      if (id !== undefined && record.type === 'SYMBOL' && reaching.has(id) && !state.has(id))
        walk(id)
    }
  return dropped
}

/**
 * The document's component loops. Which records could reach one is known once the document
 * opens, so a read of a document without loops, as Figma and OpenPencil write them, pays a
 * set lookup. The first read that could reach one repairs every loop before it expands what
 * the repair could change, so every read agrees with it.
 */
export function createComponentLoops(sources: ComponentLoopSources): ComponentLoops {
  let dropped: Set<string> | undefined
  return {
    ensure(id, report) {
      if (dropped || !sources.reaching().has(id)) return
      dropped = repair(sources)
      for (const instanceId of dropped) report?.(instanceId)
    },
    dropped: () => dropped ?? new Set()
  }
}
