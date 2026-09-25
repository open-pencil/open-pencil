import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import type { InstanceOccurrence } from '../instance-overrides/interpret'
import { occurrences } from '../instance-overrides/occurrence-path'
import { indexRecords, parentIdOf } from '../instance-overrides/source-index'

export interface ComponentConstruction {
  sourceId: string
  parentSourceId: string
  pageSourceId: string
  occurrence: InstanceOccurrence
}

/** Resolve source ownership and dependency order without mutating a destination graph. */
export function planComponentConstruction(
  changes: readonly NodeChange[],
  roots: readonly InstanceOccurrence[],
  readComponent: (id: string) => InstanceOccurrence,
  index?: ReadonlyMap<string, NodeChange>
): ComponentConstruction[] {
  const sources = index ?? indexRecords(changes)
  const pageComponents = new Map<string, InstanceOccurrence>()
  const indexPageComponents = (node: InstanceOccurrence): void => {
    if (node.mainComponentId !== null) return
    if (node.properties.type === 'SYMBOL') pageComponents.set(node.sourceId, node)
    for (const child of node.children) indexPageComponents(child)
  }
  for (const root of roots) indexPageComponents(root)
  const ordered: ComponentConstruction[] = []
  const complete = new Set<string>()
  const pending = new Set<string>()
  const ownerPage = (id: string): string => {
    const visited = new Set<string>()
    let current: string | undefined = id
    while (current) {
      if (visited.has(current)) throw new Error(`Cyclic source hierarchy at ${current}`)
      visited.add(current)
      const source = sources.get(current)
      if (!source) throw new Error(`Missing source ancestor ${current}`)
      if (source.type === 'CANVAS') return current
      current = parentIdOf(source)
    }
    throw new Error(`Component ${id} has no source page`)
  }
  const visit = (root: InstanceOccurrence): void => {
    for (const node of occurrences(root)) {
      if (node.mainComponentId !== null) ensure(node.mainComponentId)
      if (node.properties.type === 'SYMBOL') ensure(node.sourceId)
    }
  }
  const ensure = (id: string): void => {
    if (complete.has(id)) return
    if (pending.has(id)) throw new Error(`Cyclic component dependency ${id}`)
    pending.add(id)
    const source = sources.get(id)
    if (!source?.parentIndex?.guid) throw new Error(`Missing component parent ${id}`)
    const pageSourceId = ownerPage(id)
    const occurrence = pageComponents.get(id) ?? readComponent(id)
    // The definition itself is being built; only descend into its dependencies.
    for (const child of occurrence.children) visit(child)
    ordered.push({
      sourceId: id,
      parentSourceId: guidToString(source.parentIndex.guid),
      pageSourceId,
      occurrence
    })
    complete.add(id)
    pending.delete(id)
  }
  for (const root of roots) visit(root)
  return ordered
}
