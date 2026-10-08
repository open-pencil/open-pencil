import type {
  ComponentPropertyReferenceField,
  SceneGraph,
  SceneNode
} from '@open-pencil/scene-graph'

export interface ComponentBinding {
  nodeId: string
  name: string
  field: ComponentPropertyReferenceField
  node: SceneNode
  variantId: string | null
  variantName: string | null
}

export interface ComponentBindingGroup {
  key: string
  name: string
  node: SceneNode
  bindings: ComponentBinding[]
}

/** A structural path distinguishes same-named layers in different containers or sibling slots. */
function bindingPath(graph: SceneGraph, node: SceneNode, variantId: string): string {
  const path: Array<[string, string, number]> = []
  graph.closest(node.id, (current) => {
    if (current.id === variantId) return true
    const peers = (current.parentId ? graph.getChildren(current.parentId) : []).filter(
      (sibling) => sibling.type === current.type && sibling.name === current.name
    )
    path.unshift([current.type, current.name, peers.findIndex((peer) => peer.id === current.id)])
    return false
  })
  return JSON.stringify(path)
}

export function groupComponentBindings(
  graph: SceneGraph,
  bindings: Omit<ComponentBinding, 'variantId' | 'variantName'>[]
): ComponentBindingGroup[] {
  const groups = new Map<string, ComponentBindingGroup>()
  for (const binding of bindings) {
    const variant = graph.closest(
      binding.nodeId,
      (node) =>
        node.type === 'COMPONENT' &&
        !!node.parentId &&
        graph.getNode(node.parentId)?.type === 'COMPONENT_SET'
    )
    const key = variant
      ? `${binding.field}:${bindingPath(graph, binding.node, variant.id)}`
      : binding.nodeId
    let group = groups.get(key)
    if (!group) {
      group = { key, name: binding.name, node: binding.node, bindings: [] }
      groups.set(key, group)
    }
    group.bindings.push({
      ...binding,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null
    })
  }
  return [...groups.values()]
}
