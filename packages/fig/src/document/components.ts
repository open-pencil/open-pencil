import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import type { InstanceOccurrence } from '../instance-overrides/interpret'

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
  readComponent: (id: string) => InstanceOccurrence
): ComponentConstruction[] {
  const sources = new Map(
    changes.flatMap((change) => (change.guid ? [[guidToString(change.guid), change] as const] : []))
  )
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
      current = source.parentIndex?.guid ? guidToString(source.parentIndex.guid) : undefined
    }
    throw new Error(`Component ${id} has no source page`)
  }
  const visit = (node: InstanceOccurrence): void => {
    if (node.mainComponentId !== null) ensure(node.mainComponentId)
    if (node.properties.type === 'SYMBOL') ensure(node.sourceId)
    for (const child of node.children) visit(child)
  }
  const ensure = (id: string): void => {
    if (complete.has(id)) return
    if (pending.has(id)) throw new Error(`Cyclic component dependency ${id}`)
    pending.add(id)
    const source = sources.get(id)
    if (!source?.parentIndex?.guid) throw new Error(`Missing component parent ${id}`)
    const pageSourceId = ownerPage(id)
    const occurrence = readComponent(id)
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
