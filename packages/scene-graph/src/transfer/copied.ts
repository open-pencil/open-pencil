import { isEqual, mapValues } from 'es-toolkit'

import { componentPropertyDefinitions } from '../components/properties'
import type { SceneGraph } from '../graph'
import { remapInstanceOverrideState } from '../instances/overrides'
import type { ComponentPropertyDefinition, SceneNode } from '../types'

/** How a layer's references to other layers are resolved anew. */
export interface ReferenceResolvers {
  /** The component a reference names now; `previous` is the one the layer named, if any. */
  component: (id: string, previous: string | null) => string
  /** The layer an override names now; `component` is the one its instance now draws. */
  layer: (id: string, component: string | null) => string
  /** The layer a connector's end follows now. */
  endpoint: (id: string) => string
  variable: (id: string) => string
}

function swapPropertyIds(definitions: readonly ComponentPropertyDefinition[]): string[] {
  return definitions
    .filter((definition) => definition.type === 'INSTANCE_SWAP')
    .map((definition) => definition.id)
}

/** The instance-swap properties `nodes` define, whose values name components. */
export function instanceSwapPropertyIds(nodes: Iterable<SceneNode>): Set<string> {
  return new Set([...nodes].flatMap((node) => swapPropertyIds(node.componentPropertyDefinitions)))
}

/**
 * `node`'s references to other layers, resolved anew: its main component, the layers its
 * overrides change and the components they swap in, the components its instance-swap properties
 * default to or are set to, and the layers its connector ends follow. `previous` is the layer
 * whose references these replace, so a resolver can keep what it already pointed at. Only the
 * fields whose references change are returned: every write is an update collaboration sends.
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
  const overrides = remapInstanceOverrideState(node.instanceOverrides, {
    node: (id) => resolve.layer(id, componentId),
    variable: resolve.variable
  })
  if (!isEqual(overrides, node.instanceOverrides)) changes.instanceOverrides = overrides
  const previousDefaults = new Map(
    previous.componentPropertyDefinitions.map((definition) => [
      definition.id,
      definition.defaultValue
    ])
  )
  const definitions = node.componentPropertyDefinitions.map((definition) =>
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
  if (!isEqual(definitions, node.componentPropertyDefinitions))
    changes.componentPropertyDefinitions = definitions
  const assignments = mapValues(node.componentPropertyAssignments, (value, id) =>
    swapProperties.has(id)
      ? resolve.component(value, previous.componentPropertyAssignments[id] ?? null)
      : value
  )
  if (!isEqual(assignments, node.componentPropertyAssignments))
    changes.componentPropertyAssignments = assignments
  for (const field of ['connectorStart', 'connectorEnd'] as const) {
    const endpoint = node[field]
    const nodeId = endpoint?.nodeId ? resolve.endpoint(endpoint.nodeId) : null
    if (endpoint && nodeId && nodeId !== endpoint.nodeId) changes[field] = { ...endpoint, nodeId }
  }
  return changes
}

/**
 * Points copied layers at one another, as `prepareNodeTransfer` does for a paste: an instance's
 * main component, the layers its overrides change and the components they swap in, the
 * components an instance-swap property defaults to or is set to, and the layers a connector's
 * ends follow. `mappedIds` maps each copied layer to its copy, such as a library copy or a design
 * JSX render folded into the layers it replaces; a reference outside the copy stays as it is, and
 * so do variable IDs, since the copies keep their source's variables.
 */
export function remapCopiedReferences(
  graph: SceneGraph,
  mappedIds: ReadonlyMap<string, string>
): void {
  const mapped = (id: string) => mappedIds.get(id) ?? id
  const resolve: ReferenceResolvers = {
    component: mapped,
    layer: mapped,
    endpoint: mapped,
    variable: (id) => id
  }
  const copies = [...mappedIds.values()].flatMap((id) => graph.getNode(id) ?? [])
  const copiedSwaps = instanceSwapPropertyIds(copies)
  for (const node of copies) {
    // An instance's swap property may be defined on a component the copy leaves behind.
    const swapProperties = new Set([
      ...copiedSwaps,
      ...swapPropertyIds(componentPropertyDefinitions(graph, node))
    ])
    const changes = resolvedReferences(node, node, resolve, swapProperties)
    if (Object.keys(changes).length > 0) graph.updateNode(node.id, changes)
  }
}
