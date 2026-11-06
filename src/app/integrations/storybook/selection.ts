import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

export interface ImplementationSelectionStore {
  graph: SceneGraph
  state: { selectedIds: ReadonlySet<string> }
}

export interface ImplementationSelection {
  node: SceneNode
  component: SceneNode
  sourceId: string
}

/** The saved component a single selected component, set, or instance can link to. */
export function implementationSelection(
  store: ImplementationSelectionStore
): ImplementationSelection | undefined {
  if (store.state.selectedIds.size !== 1) return undefined
  const id = store.state.selectedIds.values().next().value
  const node = id ? store.graph.getNode(id) : undefined
  if (!node) return undefined
  const component = node.type === 'INSTANCE' ? store.graph.getNode(node.componentId ?? '') : node
  if (
    !component ||
    (component.type !== 'COMPONENT' && component.type !== 'COMPONENT_SET') ||
    !component.source.id
  )
    return undefined
  return { node, component, sourceId: component.source.id }
}
