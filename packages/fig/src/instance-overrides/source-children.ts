import { setInstanceOverride, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import type { InstanceOccurrence } from './interpret'
import type { MaterializedInstance } from './materialize-instance'
import { occurrences } from './occurrence-path'

export interface MaterializedComponentOccurrence {
  occurrence: InstanceOccurrence
  materialized: MaterializedInstance
}

export function reconcileOccurrenceStructure(
  target: InstanceOccurrence,
  graph: SceneGraph,
  components: ReadonlyMap<string, MaterializedComponentOccurrence>
): void {
  if (target.mainComponentId !== null) {
    const component = components.get(target.mainComponentId)
    if (!component) throw new Error(`Missing component occurrence ${target.mainComponentId}`)
    const liveOrder = new Map(
      graph.getChildren(component.materialized.root.id).map((node, index) => [node.id, index])
    )
    const sourceChildren = new Map(
      component.occurrence.children.map((child) => [child.sourceId, child])
    )
    target.children = target.children
      .filter((child) => {
        const source = sourceChildren.get(child.sourceId)
        const node = source && component.materialized.nodes.get(source)
        return !!node && liveOrder.has(node.id)
      })
      .toSorted((a, b) => {
        const sourceA = sourceChildren.get(a.sourceId)
        const sourceB = sourceChildren.get(b.sourceId)
        const nodeA = sourceA && component.materialized.nodes.get(sourceA)
        const nodeB = sourceB && component.materialized.nodes.get(sourceB)
        return (
          (nodeA ? (liveOrder.get(nodeA.id) ?? 0) : 0) -
          (nodeB ? (liveOrder.get(nodeB.id) ?? 0) : 0)
        )
      })
  }
  for (const child of target.children) reconcileOccurrenceStructure(child, graph, components)
}

/**
 * Each instance owner addresses descendants in its own component expansion.
 * A nested instance therefore has both its own correspondence and the outer
 * owner's correspondence; a swap ends the outer owner's descendant scope.
 */
/**
 * Pair each child of a target occurrence with the child of its source occurrence that has
 * the same source identity. Both sides describe one component's children, so identities
 * are unique on the source side and every target child has a counterpart.
 */
function* pairSourceChildren(
  target: InstanceOccurrence,
  source: InstanceOccurrence
): Generator<[child: InstanceOccurrence, counterpart: InstanceOccurrence]> {
  const bySource = new Map<string, InstanceOccurrence>()
  for (const child of source.children) {
    if (bySource.has(child.sourceId)) throw new Error(`Ambiguous source child ${child.sourceId}`)
    bySource.set(child.sourceId, child)
  }
  for (const child of target.children) {
    const counterpart = bySource.get(child.sourceId)
    if (!counterpart) throw new Error(`Missing source child ${child.sourceId}`)
    yield [child, counterpart]
  }
}

export function linkInstanceSourceChildren(
  root: InstanceOccurrence,
  materialized: MaterializedInstance,
  components: ReadonlyMap<string, MaterializedComponentOccurrence>
): void {
  const links: Array<{ owner: SceneNode; target: SceneNode; source: SceneNode }> = []
  const match = (
    target: InstanceOccurrence,
    source: InstanceOccurrence,
    owner: SceneNode,
    sourceNodes: ReadonlyMap<InstanceOccurrence, SceneNode>
  ): void => {
    for (const [child, counterpart] of pairSourceChildren(target, source)) {
      const targetNode = materialized.nodes.get(child)
      const sourceNode = sourceNodes.get(counterpart)
      if (!targetNode || !sourceNode) {
        throw new Error(`Missing materialized correspondence for ${child.sourceId}`)
      }
      links.push({ owner, target: targetNode, source: sourceNode })
      if (child.mainComponentId === counterpart.mainComponentId) {
        match(child, counterpart, owner, sourceNodes)
      }
    }
  }
  for (const current of occurrences(root)) {
    if (current.mainComponentId === null) continue
    const component = components.get(current.mainComponentId)
    const owner = materialized.nodes.get(current)
    if (!component || !owner) throw new Error(`Missing component ${current.mainComponentId}`)
    match(current, component.occurrence, owner, component.materialized.nodes)
  }
  for (const { owner, target, source } of links) {
    setInstanceOverride(
      owner.instanceOverrides,
      owner.id,
      target.id,
      'sourceComponentId',
      source.id
    )
    if (target.type === 'INSTANCE' && target.componentId !== source.componentId) {
      setInstanceOverride(
        owner.instanceOverrides,
        owner.id,
        target.id,
        'componentId',
        target.componentId
      )
    }
  }
}

/** Match children within one component occurrence, never across instance boundaries. */
export function mapInstanceSourceChildren(
  instance: InstanceOccurrence,
  components: ReadonlyMap<string, MaterializedComponentOccurrence>
): ReadonlyMap<InstanceOccurrence, string> {
  const result = new Map<InstanceOccurrence, string>()
  const matchChildren = (
    target: InstanceOccurrence,
    source: InstanceOccurrence,
    nodes: ReadonlyMap<InstanceOccurrence, SceneNode>
  ): void => {
    for (const [child, counterpart] of pairSourceChildren(target, source)) {
      const node = nodes.get(counterpart)
      if (!node) throw new Error(`Unmaterialized source child ${counterpart.sourceId}`)
      result.set(child, node.id)
      if (child.mainComponentId !== null) expand(child)
      else matchChildren(child, counterpart, nodes)
    }
  }
  const expand = (target: InstanceOccurrence): void => {
    if (target.mainComponentId === null) throw new Error('Expected instance occurrence')
    const component = components.get(target.mainComponentId)
    if (!component) throw new Error(`Missing component occurrence ${target.mainComponentId}`)
    matchChildren(target, component.occurrence, component.materialized.nodes)
  }
  const visit = (target: InstanceOccurrence): void => {
    if (target.mainComponentId !== null) expand(target)
    else for (const child of target.children) visit(child)
  }
  visit(instance)
  return result
}
