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

/** A name as a path segment: `/` separates segments and `#` the twin index, so both are escaped. */
const pathName = (name: string) => name.replace(/[%/#]/g, (char) => encodeURIComponent(char))

/**
 * A layer's path below a root: the names of the layers down to it, with the position among
 * same-named siblings when names repeat. It stays the same when a variant switch rebuilds an
 * instance's layers, so it identifies controls and keeps their DOM in place.
 */
export function layerPath(graph: SceneGraph, rootId: string, nodeId: string): string {
  const segments: string[] = []
  // `closest` stops on a parent cycle in bad data, where a hand-written walk would not.
  graph.closest(nodeId, (node) => {
    if (node.id === rootId) return true
    const twins = node.parentId
      ? graph.getChildren(node.parentId).filter((child) => child.name === node.name)
      : []
    const index = twins.findIndex((child) => child.id === node.id)
    segments.unshift(twins.length > 1 ? `${pathName(node.name)}#${index}` : pathName(node.name))
    return false
  })
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
    const twins = graph.getChildren(current.id).filter((child) => pathName(child.name) === name)
    current = twins.at(hash === -1 ? 0 : Number(segment.slice(hash + 1)))
  }
  return current
}
