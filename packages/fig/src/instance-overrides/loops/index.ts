import {
  definitionOf,
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

/** The components defined directly inside `componentId`'s definition, as choices it holds. */
function heldDefinitions(order: SourceIndex, componentId: string) {
  const held: (ComponentChoice & { held: true })[] = []
  for (const record of subtree(order, componentId)) {
    const id = idOf(record)
    const parent = parentIdOf(record)
    if (
      id !== undefined &&
      id !== componentId &&
      record.type === 'SYMBOL' &&
      parent !== undefined &&
      definitionOf(order, parent) === componentId
    )
      held.push({ ownerId: id, componentId: id, held: true })
  }
  return held
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
  /** The definitions being walked, outermost first, each with the instance whose choice entered it. */
  const stack: { componentId: string; enteredBy: string | null }[] = []
  /**
   * The instance to leave out when a definition leads back into `componentId` by holding it:
   * the first one whose choice entered a definition after it. A component is never left out.
   */
  const enteringInstance = (componentId: string): string | undefined => {
    const from = stack.findIndex((entry) => entry.componentId === componentId)
    return stack.slice(from + 1).find((entry) => entry.enteredBy !== null)?.enteredBy ?? undefined
  }
  const walk = (componentId: string, enteredBy: string | null): void => {
    state.set(componentId, 'walking')
    stack.push({ componentId, enteredBy })
    const layer = new Map<string, number>()
    for (const record of subtree(sources.order, componentId)) {
      const id = idOf(record)
      if (id !== undefined) layer.set(id, layer.size)
    }
    // A component defined inside this one is expanded with it, so it is walked where it lies.
    const nested = heldDefinitions(sources.order, componentId)
    const discover = (): (ComponentChoice & { held?: true })[] =>
      [
        ...sources
          .discover(index, componentId, dropped)
          .filter(({ ownerId }) => definitionOf(sources.order, ownerId) === componentId),
        ...nested
      ].toSorted((a, b) => (layer.get(a.ownerId) ?? 0) - (layer.get(b.ownerId) ?? 0))
    const handled = new Set<string>()
    let choices = discover()
    for (let next = 0; next < choices.length; next++) {
      const { ownerId, componentId: chosen, held } = choices[next]
      const key = `${ownerId} ${chosen}`
      if (dropped.has(ownerId) || handled.has(key)) continue
      handled.add(key)
      const target = terminalComponent(index, chosen)
      const reached = state.get(target)
      if (reached === 'walking') {
        const instance = held ? enteringInstance(target) : ownerId
        if (instance !== undefined) dropped.add(instance)
      }
      // An instance chain that leads back into itself ends without a component: the read shows
      // it empty, and there is no definition to walk.
      else if (
        reached === undefined &&
        reaching.has(target) &&
        index.sources.get(target)?.type === 'SYMBOL'
      ) {
        const before = dropped.size
        walk(target, held ? null : ownerId)
        // The deeper walk left instances out, so a later choice may have swapped through one:
        // read the choices again, as the definition now expands.
        if (dropped.size !== before) {
          choices = discover()
          next = -1
        }
      }
    }
    stack.pop()
    state.set(componentId, 'done')
  }
  for (const root of roots(sources.order))
    for (const record of subtree(sources.order, root)) {
      const id = idOf(record)
      if (id !== undefined && record.type === 'SYMBOL' && reaching.has(id) && !state.has(id))
        walk(id, null)
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
