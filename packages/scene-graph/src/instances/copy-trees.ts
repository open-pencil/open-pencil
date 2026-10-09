import { cloneNodeProps } from '../copy'
import type { SceneGraph } from '../index'
import { remapInstanceOverrideState } from '../instance-overrides'
import type { SceneNode } from '../types'
import { instanceLayerId, isInstanceLayerId, parseInstanceLayerId } from './layer-ids'

/**
 * Copy layer trees from one graph into another under `parentId`, and return the new id of every
 * layer copied. Layers of their own get fresh ids; a copy inside an instance is named after its
 * instance's and component layers' new ids, so instances keep showing the components copied
 * with them. Component references and override paths follow the components copied; ones that
 * point outside the copied trees stay as they are. Trees already copied are skipped.
 */
export function copyLayerTrees(
  source: SceneGraph,
  target: SceneGraph,
  rootIds: readonly string[],
  parentId: string,
  props: (node: SceneNode) => Partial<SceneNode> = (node) => cloneNodeProps(node, null),
  ids = new Map<string, string>()
): Map<string, string> {
  const fresh = new Set<string>()
  const allocate = (id: string): void => {
    const node = source.getNode(id)
    if (!node || ids.has(id) || fresh.has(id)) return
    if (!isInstanceLayerId(id)) {
      ids.set(id, target.nextNodeId())
      fresh.add(id)
    }
    for (const childId of node.childIds) allocate(childId)
  }
  for (const id of rootIds) allocate(id)
  const remap = (id: string) => ids.get(id) ?? id
  const idOf = (node: SceneNode): string => {
    const address = parseInstanceLayerId(node.id)
    const owner = address && ids.get(address.owner)
    if (address && owner) return instanceLayerId(owner, address.path.map(remap))
    // A copy taken without its instance is a layer of its own.
    return ids.get(node.id) ?? target.nextNodeId()
  }
  const copy = (node: SceneNode, parent: string): void => {
    const id = idOf(node)
    ids.set(node.id, id)
    target.createNodeWithId(id, node.type, parent, {
      ...props(node),
      componentId: node.componentId && remap(node.componentId),
      instanceOverrides: remapInstanceOverrideState(node.instanceOverrides, {
        node: remap,
        variable: (variableId) => variableId
      }),
      childIds: []
    })
    for (const child of source.getChildren(node.id)) copy(child, id)
  }
  for (const rootId of rootIds) {
    const root = source.getNode(rootId)
    if (root && fresh.has(rootId) && !target.getNode(ids.get(rootId) ?? '')) copy(root, parentId)
  }
  return ids
}
