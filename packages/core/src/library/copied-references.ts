import { mapValues } from 'es-toolkit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { remapInstanceOverrideState } from '@open-pencil/scene-graph/instances/overrides'

/** How a layer's references to other layers are resolved anew. */
export interface ReferenceResolvers {
  /** The component a reference names now; `previous` is the one the layer named, if any. */
  component: (id: string, previous: string | null) => string
  /** The layer an override names now; `component` is the one its instance now draws. */
  layer: (id: string, component: string | null) => string
  variable: (id: string) => string
}

/** The instance-swap properties `nodes` define, whose values name components. */
export function instanceSwapPropertyIds(nodes: Iterable<SceneNode>): Set<string> {
  return new Set(
    [...nodes].flatMap((node) =>
      node.componentPropertyDefinitions.flatMap((definition) =>
        definition.type === 'INSTANCE_SWAP' ? [definition.id] : []
      )
    )
  )
}

/**
 * `node`'s references to other layers, resolved anew: its main component, the layers its
 * overrides change and the components they swap in, and the components its instance-swap
 * properties default to or are set to. `previous` is the layer whose references these replace, so
 * a resolver can keep what it already pointed at. Only the fields whose references change are
 * returned.
 */
export function resolvedReferences(
  node: SceneNode,
  previous: SceneNode,
  resolve: ReferenceResolvers,
  swapProperties: ReadonlySet<string>
): Partial<SceneNode> {
  const changes: Partial<SceneNode> = {}
  const componentId = node.componentId
    ? resolve.component(node.componentId, previous.componentId)
    : null
  if (componentId !== node.componentId) changes.componentId = componentId
  const overrides = node.instanceOverrides
  if (overrides.self.size > 0 || overrides.descendants.size > 0) {
    changes.instanceOverrides = remapInstanceOverrideState(overrides, {
      node: (id) => resolve.layer(id, componentId),
      variable: resolve.variable
    })
  }
  if (node.componentPropertyDefinitions.some((definition) => definition.type === 'INSTANCE_SWAP')) {
    const previousDefaults = new Map(
      previous.componentPropertyDefinitions.map((definition) => [
        definition.id,
        definition.defaultValue
      ])
    )
    changes.componentPropertyDefinitions = node.componentPropertyDefinitions.map((definition) =>
      definition.type === 'INSTANCE_SWAP' && definition.defaultValue
        ? {
            ...definition,
            defaultValue: resolve.component(
              definition.defaultValue,
              previousDefaults.get(definition.id) ?? null
            )
          }
        : definition
    )
  }
  if (Object.keys(node.componentPropertyAssignments).some((id) => swapProperties.has(id))) {
    changes.componentPropertyAssignments = mapValues(
      node.componentPropertyAssignments,
      (value, id) =>
        swapProperties.has(id)
          ? resolve.component(value, previous.componentPropertyAssignments[id] ?? null)
          : value
    )
  }
  return changes
}

/**
 * Points the layers a library copy made at one another, as `prepareNodeTransfer` does for a
 * paste: an instance's main component, the layers its overrides change and the components they
 * swap in, and the components an instance-swap property defaults to or is set to. `mappedIds`
 * maps each copied layer to its copy; a reference outside the copy stays as it is, and so do
 * variable IDs, since the copies keep their source's variables.
 */
export function remapCopiedReferences(
  graph: SceneGraph,
  mappedIds: ReadonlyMap<string, string>
): void {
  const mapped = (id: string) => mappedIds.get(id) ?? id
  const copies = [...mappedIds.values()].flatMap((id) => graph.getNode(id) ?? [])
  const swapProperties = instanceSwapPropertyIds(copies)
  const resolve: ReferenceResolvers = { component: mapped, layer: mapped, variable: (id) => id }
  for (const node of copies) {
    const changes = resolvedReferences(node, node, resolve, swapProperties)
    if (Object.keys(changes).length > 0) graph.updateNode(node.id, changes)
  }
}
