import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import { assignmentValue } from '../bindings/properties'
import { idOf, parentIdOf, type SourceIndex } from '../source-index'
import { descendants } from '../tree'
import {
  symbolOverridesOf,
  type ComponentPropAssignment,
  type ComponentPropDef,
  type ComponentPropValue
} from '../types'

function pushAssigned(
  named: GUID[],
  assignments: readonly ComponentPropAssignment[] | undefined
): void {
  for (const assignment of assignments ?? []) {
    const value = assignmentValue(assignment)?.guidValue
    if (value) named.push(value)
  }
}

/**
 * Every record a record could have a read expand in its place: the component it shows, the
 * components its overrides swap in, and the values it assigns to swap and slot properties. Whether an override's path still resolves is not asked,
 * so these include every record a read could reach from here, and more. Every record of a
 * document passes through here as it opens, so nothing is allocated for one that names none.
 */
function namedRecords(record: NodeChange): GUID[] {
  const named: GUID[] = []
  const symbolID = record.symbolData?.symbolID
  if (symbolID) named.push(symbolID)
  for (const override of symbolOverridesOf(record)) {
    if (override.overriddenSymbolID) named.push(override.overriddenSymbolID)
    pushAssigned(named, override.componentPropAssignments)
  }
  pushAssigned(named, record.componentPropAssignments as ComponentPropAssignment[] | undefined)
  return named
}

/** The records a record's property definitions default to. */
function definedDefaults(definitions: readonly ComponentPropDef[]): string[] {
  const defaults: string[] = []
  for (const definition of definitions) {
    const value: ComponentPropValue | undefined = definition.initialValue
    if (value?.guidValue) defaults.push(guidToString(value.guidValue))
  }
  return defaults
}

/** A record and its descendants, in layer order. */
export function* subtree({ sources, children }: SourceIndex, id: string): Generator<NodeChange> {
  const record = sources.get(id)
  if (!record) return
  yield* descendants(record, (node) => {
    const nodeId = idOf(node)
    return (nodeId === undefined ? undefined : children.get(nodeId)) ?? []
  })
}

/** Records in a loop of `edges`, by Tarjan's strongly connected components. */
function recordsInLoops(edges: ReadonlyMap<string, readonly string[]>): Set<string> {
  const indexOf = new Map<string, number>()
  const lowest = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const looped = new Set<string>()
  const visit = (id: string) => {
    indexOf.set(id, indexOf.size)
    lowest.set(id, indexOf.size - 1)
    stack.push(id)
    onStack.add(id)
  }
  for (const start of edges.keys()) {
    if (indexOf.has(start)) continue
    visit(start)
    const frames: { id: string; next: number }[] = [{ id: start, next: 0 }]
    while (frames.length > 0) {
      const frame = frames[frames.length - 1]
      const targets = edges.get(frame.id) ?? []
      if (frame.next < targets.length) {
        const target = targets[frame.next++]
        if (!indexOf.has(target)) {
          visit(target)
          frames.push({ id: target, next: 0 })
        } else if (onStack.has(target)) {
          lowest.set(frame.id, Math.min(lowest.get(frame.id) ?? 0, indexOf.get(target) ?? 0))
        }
        continue
      }
      frames.pop()
      const parent = frames.at(-1)
      if (parent)
        lowest.set(parent.id, Math.min(lowest.get(parent.id) ?? 0, lowest.get(frame.id) ?? 0))
      if (lowest.get(frame.id) !== indexOf.get(frame.id)) continue
      const members: string[] = []
      let member: string | undefined
      do {
        member = stack.pop()
        if (member === undefined) break
        onStack.delete(member)
        members.push(member)
      } while (member !== frame.id)
      if (members.length > 1 || targets.includes(frame.id)) for (const id of members) looped.add(id)
    }
  }
  return looped
}

type ParentOf = (id: string) => string | undefined
type Naming = readonly (readonly [string, readonly string[]])[]

/** A record and its ancestors, nearest first, which stops at a parent loop. */
function* lineage(parentOf: ParentOf, id: string): Generator<string> {
  const seen = new Set<string>()
  for (let current: string | undefined = id; current !== undefined; current = parentOf(current)) {
    if (seen.has(current)) return
    seen.add(current)
    yield current
  }
}

/**
 * The nearest named record holding each record, the record included, found once per record:
 * one further out reaches the records inside through it.
 */
function holderLookup(parentOf: ParentOf, named: ReadonlySet<string>) {
  const holders = new Map<string, string | null>()
  return (id: string): string | null => {
    const climbed: string[] = []
    let holder: string | null = null
    for (let current: string | undefined = id; current !== undefined; current = parentOf(current)) {
      const known = holders.get(current)
      if (known !== undefined) {
        holder = known
        break
      }
      if (climbed.includes(current)) break
      climbed.push(current)
      if (named.has(current)) {
        holder = current
        break
      }
    }
    for (const id of climbed) holders.set(id, holder)
    return holder
  }
}

/**
 * Each named record to the records it leads to. `components` are the document's component
 * definitions, which no other record holds.
 */
function namedEdges(
  parentOf: ParentOf,
  naming: Naming,
  components: ReadonlySet<string>
): Map<string, string[]> {
  const named = new Set<string>()
  for (const [, targets] of naming) for (const target of targets) named.add(target)
  const holderOf = holderLookup(parentOf, named)
  const edges = new Map<string, string[]>()
  const link = (holder: string, targets: readonly string[]) => {
    const list = edges.get(holder)
    if (!list) edges.set(holder, [...targets])
    else for (const target of targets) list.push(target)
  }
  for (const [id, targets] of naming) {
    const holder = holderOf(id)
    if (holder !== null) link(holder, targets)
  }
  // A named record inside another is expanded with it, so the outer one leads to it too: a
  // self-instance that some placement also uses as its base still closes its loop.
  for (const id of named) {
    if (components.has(id)) continue
    const parent = parentOf(id)
    const holder = parent === undefined ? null : holderOf(parent)
    if (holder !== null) link(holder, [id])
  }
  return edges
}

/** `looped` and every record with an edge that leads to one of them. */
function reachingBack(edges: ReadonlyMap<string, readonly string[]>, looped: Set<string>) {
  const referrers = new Map<string, string[]>()
  for (const [id, targets] of edges)
    for (const target of targets) {
      const list = referrers.get(target)
      if (list) list.push(id)
      else referrers.set(target, [id])
    }
  const reaching = new Set(looped)
  const queue = [...looped]
  for (let next = queue.pop(); next !== undefined; next = queue.pop())
    for (const referrer of referrers.get(next) ?? [])
      if (!reaching.has(referrer)) {
        reaching.add(referrer)
        queue.push(referrer)
      }
  return reaching
}

/**
 * The records from which a read could reach a component loop: the records a loop runs
 * through, every record that names one of them or holds a record that does, and their
 * ancestors. A loop runs through named records only, since a read enters a record's subtree by
 * choosing it, so only records that name others and the records they name are graphed: a
 * named record leads to every record named inside it, and to every named record it holds. A
 * document without a loop, as Figma and OpenPencil write them, has none. Records are added one
 * at a time, as a reader that decodes each once at opening passes them; `parentOf` answers from
 * the document's index.
 */
export function createReferenceGraph(parentOf: ParentOf) {
  const naming: [string, string[]][] = []
  /** The components each record's property definitions default to. */
  const defaults = new Map<string, string[]>()
  /** Records with a definition that takes its default from an ancestor's, as a variant's do. */
  const linking: string[] = []
  const components = new Set<string>()
  return {
    add(record: NodeChange): void {
      const id = idOf(record)
      if (id === undefined) return
      if (record.type === 'SYMBOL') components.add(id)
      const named = namedRecords(record)
      const definitions = record.componentPropDefs as ComponentPropDef[] | undefined
      if (!definitions) {
        if (named.length > 0) naming.push([id, named.map(guidToString)])
        return
      }
      const own = definedDefaults(definitions)
      if (own.length > 0) defaults.set(id, own)
      if (definitions.some((definition) => definition.parentPropDefId)) linking.push(id)
      const targets = [...named.map(guidToString), ...own]
      if (targets.length > 0) naming.push([id, targets])
    },
    reaching(): Set<string> {
      // A linked definition is completed from an ancestor's as a read prepares the record, so
      // the record can name any default its ancestors' definitions give.
      const entries: [string, string[]][] = [...naming]
      // The defaults a record and its ancestors define, found once per record: a set's
      // variants share their ancestors.
      const above = new Map<string, readonly string[]>()
      const definedAbove = (id: string | undefined, seen: Set<string>): readonly string[] => {
        if (id === undefined || seen.has(id)) return []
        const known = above.get(id)
        if (known) return known
        seen.add(id)
        const own = defaults.get(id) ?? []
        const outer = definedAbove(parentOf(id), seen)
        let found: readonly string[] = own
        if (own.length === 0) found = outer
        else if (outer.length > 0) found = [...own, ...outer]
        above.set(id, found)
        return found
      }
      for (const id of linking) {
        const inherited = definedAbove(parentOf(id), new Set([id]))
        if (inherited.length > 0) entries.push([id, [...inherited]])
      }
      const edges = namedEdges(parentOf, entries, components)
      const looped = recordsInLoops(edges)
      if (looped.size === 0) return looped
      const reaching = reachingBack(edges, looped)
      // Records nothing names reach a loop through what they hold, as a page or a component
      // placed before the loop does; a repair walks the components among them in layer order.
      for (const [id, targets] of entries)
        if (targets.some((target) => reaching.has(target)))
          for (const holder of lineage(parentOf, id)) reaching.add(holder)
      return reaching
    }
  }
}

/** The records of `index` from which a read could reach a component loop. */
export function recordsReachingLoops(index: SourceIndex): Set<string> {
  const graph = createReferenceGraph((id) => {
    const record = index.sources.get(id)
    return record && parentIdOf(record)
  })
  for (const record of index.sources.values()) graph.add(record)
  return graph.reaching()
}
