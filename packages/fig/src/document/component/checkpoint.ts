import type { InstanceOccurrence } from '#fig/instance-overrides/interpret'
import type { MaterializedComponentOccurrence } from '#fig/instance-overrides/source-children'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

export interface ComponentCheckpoint {
  rootId: string
  nodes: Array<{ path: string[]; nodeId: string; mainComponentId: string | null }>
}

/** Paths use source identities at every hierarchy level, never names or child indexes. */
export function checkpointComponent(
  component: MaterializedComponentOccurrence
): ComponentCheckpoint {
  const nodes: ComponentCheckpoint['nodes'] = []
  const visit = (occurrence: InstanceOccurrence, path: string[]): void => {
    const node = component.materialized.nodes.get(occurrence)
    if (!node) throw new Error('Missing checkpoint occurrence')
    nodes.push({ path, nodeId: node.id, mainComponentId: occurrence.mainComponentId })
    const ids = new Set<string>()
    for (const child of occurrence.children) {
      if (ids.has(child.sourceId)) throw new Error(`Ambiguous checkpoint child ${child.sourceId}`)
      ids.add(child.sourceId)
      visit(child, [...path, child.sourceId])
    }
  }
  visit(component.occurrence, [])
  return { rootId: component.materialized.root.id, nodes }
}

export function restoreComponentCheckpoint(
  graph: SceneGraph,
  occurrence: InstanceOccurrence,
  checkpoint: ComponentCheckpoint
): MaterializedComponentOccurrence {
  const root = graph.getNode(checkpoint.rootId)
  if (!root) throw new Error(`Missing resumed component ${checkpoint.rootId}`)
  const nodes = new Map<InstanceOccurrence, SceneNode>()
  for (const entry of checkpoint.nodes) {
    let target = occurrence
    for (const id of entry.path) {
      const matches = target.children.filter((child) => child.sourceId === id)
      if (matches.length !== 1) throw new Error(`Invalid checkpoint source path ${id}`)
      target = matches[0]
    }
    const node = graph.getNode(entry.nodeId)
    if (!node || nodes.has(target) || target.mainComponentId !== entry.mainComponentId) {
      throw new Error(`Invalid checkpoint occurrence ${entry.nodeId}`)
    }
    nodes.set(target, node)
  }
  const validate = (target: InstanceOccurrence): void => {
    if (!nodes.has(target)) throw new Error('Incomplete component checkpoint')
    for (const child of target.children) validate(child)
  }
  validate(occurrence)
  if (nodes.get(occurrence) !== root) throw new Error('Invalid checkpoint root')
  return { occurrence, materialized: { root, nodes } }
}
