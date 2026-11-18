import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import { assignmentValue } from '../bindings/properties'
import { idOf, parentIdOf, type SourceIndex } from '../source-index'
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
 * components its overrides swap in, the values it assigns to swap and slot properties, and the
 * defaults of the properties it defines. Whether an override's path still resolves is not asked,
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
  for (const definition of (record.componentPropDefs ?? []) as ComponentPropDef[]) {
    const value: ComponentPropValue | undefined = definition.initialValue
    if (value?.guidValue) named.push(value.guidValue)
  }
  return named
}

/** A record and its descendants, in layer order. */
export function* subtree({ sources, children }: SourceIndex, id: string): Generator<NodeChange> {
  const record = sources.get(id)
  if (!record) return
  yield record
  for (const child of children.get(id) ?? []) {
    const childId = idOf(child)
    if (childId !== undefined) yield* subtree({ sources, children }, childId)
  }
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

/**
 * The records from which a read could reach a component loop: the records a loop runs
 * through, every record that names one of them or holds a record that does, and their
 * ancestors. A loop runs through named records only, since a read enters a record's subtree by
 * choosing it, so only records that name others and the records they name are graphed: a
 * named record leads to every record named inside it. A document without a loop, as Figma and
 * OpenPencil write them, has none. Records are added one at a time, as a reader that decodes
 * each once at opening passes them; `parentOf` answers from the document's index.
 */
export function createReferenceGraph(parentOf: (id: string) => string | undefined) {
  const naming: [string, string[]][] = []
  /** Each record and its ancestors, nearest first, which stops at a parent loop. */
  const lineage = function* (id: string): Generator<string> {
    const seen = new Set<string>()
    for (let current: string | undefined = id; current !== undefined; current = parentOf(current)) {
      if (seen.has(current)) return
      seen.add(current)
      yield current
    }
  }
  return {
    add(record: NodeChange): void {
      const id = idOf(record)
      if (id === undefined) return
      const targets = namedRecords(record)
      if (targets.length > 0) naming.push([id, targets.map(guidToString)])
    },
    reaching(): Set<string> {
      const named = new Set<string>()
      for (const [, targets] of naming) for (const target of targets) named.add(target)
      // The nearest named record holding each record, the record included, found once per
      // record: one further out reaches the records inside through it.
      const holders = new Map<string, string | null>()
      const holderOf = (id: string): string | null => {
        const climbed: string[] = []
        let holder: string | null = null
        for (
          let current: string | undefined = id;
          current !== undefined;
          current = parentOf(current)
        ) {
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
      const edges = new Map<string, string[]>()
      for (const [id, targets] of naming) {
        const holder = holderOf(id)
        if (holder === null) continue
        const list = edges.get(holder)
        if (!list) edges.set(holder, [...targets])
        else for (const target of targets) list.push(target)
      }
      const looped = recordsInLoops(edges)
      if (looped.size === 0) return looped
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
      // Records nothing names reach a loop through what they hold, as a page or a component
      // placed before the loop does; a repair walks the components among them in layer order.
      for (const [id, targets] of naming)
        if (targets.some((target) => reaching.has(target)))
          for (const holder of lineage(id)) reaching.add(holder)
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
