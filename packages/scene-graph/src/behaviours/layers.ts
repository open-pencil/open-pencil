import type { SceneGraph } from '../index'
import type { SceneNode } from '../types'
import { behaviourOwner, readBehaviour } from './model'

/** Whether an instance's main component, or its set, has a behaviour. */
export function hasBehaviour(graph: SceneGraph, node: SceneNode): boolean {
  if (node.type !== 'INSTANCE' || !node.componentId) return false
  const component = graph.getNode(node.componentId)
  const owner = component && behaviourOwner(graph, component)
  return !!owner && !!readBehaviour(owner)
}

/**
 * A layer's path below a root: the names of the layers down to it, with the position among
 * same-named siblings when names repeat. It stays the same when a variant switch rebuilds an
 * instance's layers, so it identifies controls and keeps their DOM in place.
 */
export function layerPath(graph: SceneGraph, rootId: string, nodeId: string): string {
  const segments: string[] = []
  let current = graph.getNode(nodeId)
  while (current && current.id !== rootId) {
    const parent = current.parentId ? graph.getNode(current.parentId) : undefined
    const { id, name } = current
    const twins = parent ? graph.getChildren(parent.id).filter((child) => child.name === name) : []
    const index = twins.findIndex((child) => child.id === id)
    segments.unshift(twins.length > 1 ? `${name}#${index}` : name)
    current = parent
  }
  return segments.join('/')
}

/** The layer at `path` below a root, the inverse of `layerPath`. */
export function findLayerByPath(
  graph: SceneGraph,
  rootId: string,
  path: string
): SceneNode | undefined {
  let current = graph.getNode(rootId)
  for (const segment of path ? path.split('/') : []) {
    if (!current) return undefined
    const hash = segment.lastIndexOf('#')
    const name = hash === -1 ? segment : segment.slice(0, hash)
    const twins = graph.getChildren(current.id).filter((child) => child.name === name)
    current = twins.at(hash === -1 ? 0 : Number(segment.slice(hash + 1)))
  }
  return current
}
