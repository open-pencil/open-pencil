import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { setInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'

import type { MaterializedInstance } from './materialize-instance'
import { occurrences } from './occurrence/path'
import type { InstanceOccurrence } from './occurrence/types'

export interface MaterializedComponentOccurrence {
  occurrence: InstanceOccurrence
  materialized: MaterializedInstance
}

export function reconcileOccurrenceStructure(
  target: InstanceOccurrence,
  graph: SceneGraph,
  components: ReadonlyMap<string, MaterializedComponentOccurrence>
): void {
  if (target.mainComponentId === null) {
    for (const child of target.children) reconcileOccurrenceStructure(child, graph, components)
    return
  }
  const component = components.get(target.mainComponentId)
  if (!component) throw new Error(`Missing component occurrence ${target.mainComponentId}`)
  const nodes = component.materialized.nodes
  // Walk the component's own layers, frames inside it included, beside the instance's.
  const reconcileLayers = (current: InstanceOccurrence, source: InstanceOccurrence): void => {
    const layer = nodes.get(source)
    const liveOrder = new Map(
      (layer ? graph.getChildren(layer.id) : []).map((node, index) => [node.id, index])
    )
    const sourceChildren = new Map(source.children.map((child) => [child.sourceId, child]))
    const liveIndex = (child: InstanceOccurrence): number | undefined => {
      const counterpart = sourceChildren.get(child.sourceId)
      const node = counterpart && nodes.get(counterpart)
      return node && liveOrder.get(node.id)
    }
    current.children = current.children
      .filter((child) => liveIndex(child) !== undefined)
      .toSorted((a, b) => (liveIndex(a) ?? 0) - (liveIndex(b) ?? 0))
    for (const child of current.children) {
      const counterpart = sourceChildren.get(child.sourceId)
      // Nested instances answer to their own components; slot content is the instance's own.
      if (child.mainComponentId !== null || child.slotContentId || !counterpart) {
        reconcileOccurrenceStructure(child, graph, components)
      } else reconcileLayers(child, counterpart)
    }
  }
  reconcileLayers(target, component.occurrence)
}

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

/**
 * A built definition's layers under the occurrences of an enclosing tree, which may have read the
 * definition separately on another page. Layers deleted since a resumed checkpoint are left out,
 * as the checkpoint leaves them out.
 */
export function mapMaterializedComponentNodes(
  target: InstanceOccurrence,
  component: MaterializedComponentOccurrence
): ReadonlyMap<InstanceOccurrence, SceneNode> {
  const nodes = new Map<InstanceOccurrence, SceneNode>()
  const visit = (current: InstanceOccurrence, source: InstanceOccurrence): void => {
    const node = component.materialized.nodes.get(source)
    if (!node) return
    nodes.set(current, node)
    for (const [child, counterpart] of pairSourceChildren(current, source))
      visit(child, counterpart)
  }
  visit(target, component.occurrence)
  return nodes
}

/**
 * Each instance owner addresses descendants in its own component expansion. A nested
 * instance therefore has both its own correspondence and the outer owner's; a swap ends
 * the outer owner's descendant scope.
 */
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
      // Slot content is the instance's own; its instances are owners in their own right.
      if (child.slotContentId) continue
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
      else if (child.slotContentId) for (const content of child.children) visit(content)
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
