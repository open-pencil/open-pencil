import { cloneNodeProps } from '../copy'
import type { SceneGraph } from '../index'
import type { OverridePath } from '../instance-overrides'
import type { SceneNode, SourceMetadata } from '../types'
import { ownOverrides } from './adopt'
import { instanceLayerId, parseInstanceLayerId } from './layer-ids'

/** The instance whose copies are being cloned, under its new id, and its path in the original. */
interface CloneScope {
  readonly owner: string
  readonly prefix: OverridePath
}

function cloneLayer(
  graph: SceneGraph,
  source: SceneNode,
  parentId: string,
  overrides: Partial<SceneNode>,
  scope: CloneScope | null
): SceneNode {
  const address = parseInstanceLayerId(source.id)
  const props = cloneNodeProps(source, null)
  // Null out Figma source identifiers so the clone is treated as local.
  props.source = { ...(props.source as SourceMetadata), id: null, orderKey: null }
  let id: string
  let next = scope
  if (address && scope) {
    id = instanceLayerId(scope.owner, address.path.slice(scope.prefix.length))
  } else {
    id = graph.nextNodeId()
    if (source.type === 'INSTANCE') {
      next = { owner: id, prefix: address?.path ?? [] }
      // A copy of a nested instance cloned on its own takes the overrides it showed.
      if (address) {
        const owner = graph.getNode(address.owner)
        if (owner)
          props.instanceOverrides = ownOverrides(
            graph,
            { node: source, prefix: address.path },
            owner.instanceOverrides
          )
      }
    }
  }
  const clone = graph.createNodeWithId(id, source.type, parentId, { ...props, ...overrides })
  for (const child of graph.getChildren(source.id)) cloneLayer(graph, child, clone.id, {}, next)
  return clone
}

/**
 * Clone a layer and everything in it. An instance's copies are named after the new instance;
 * layers cloned out of an instance become layers of their own, and a nested instance among
 * them an instance of its own.
 */
export function cloneLayerTree(
  graph: SceneGraph,
  source: SceneNode,
  parentId: string,
  overrides: Partial<SceneNode> = {}
): SceneNode {
  return cloneLayer(graph, source, parentId, overrides, null)
}
