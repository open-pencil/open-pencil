import { groupBy } from 'es-toolkit'

import type { SceneGraph } from '../graph'
import { effectiveStatus } from './node'
import type { StatusWorkflow } from './schema'
import { findStatusState } from './workflow'

/** A group of layers that would show another state, or none when `to` is null. */
export interface StatusWorkflowImpact {
  from: string
  to: string | null
  count: number
}

/**
 * What replacing the `current` workflow with `next` does to the layers that show a status, where
 * `moves` sends the layers in a state `next` drops to another state or clears theirs with null.
 * Renamed and moved states both read here as the name people will see change.
 */
export function statusWorkflowImpact(
  graph: SceneGraph,
  current: StatusWorkflow,
  next: StatusWorkflow,
  moves: Readonly<Partial<Record<string, string | null>>>
): StatusWorkflowImpact[] {
  const changes: { from: string; to: string | null }[] = []
  for (const node of graph.getAllNodes()) {
    const id = effectiveStatus(graph, node)
    if (id === null) continue
    const from = findStatusState(current, id)?.name
    if (from === undefined) continue
    const target = moves[id]
    const to = target === null ? null : (findStatusState(next, target ?? id)?.name ?? null)
    if (to !== from) changes.push({ from, to })
  }
  const groups = groupBy(changes, (change) => `${change.from}\0${change.to ?? ''}`)
  return Object.values(groups).map((group) => ({ ...group[0], count: group.length }))
}
