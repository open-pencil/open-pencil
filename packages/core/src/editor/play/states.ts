import {
  applyComponentPropertyValue,
  componentPropertyDefinitions,
  findLayerByPath,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import { extractPageContext, findPageId } from '#core/io/subgraph'
import { computeAllLayouts } from '#core/layout'

/** How one instance of an island is shown: the variant, properties, and layers it displays. */
export interface InstanceState {
  /** Variant values by property name the instance must show. */
  variants?: Record<string, string>
  /**
   * Variant values shown when the set draws them together with `variants`, such as a hover
   * state; otherwise those properties keep the instance's own values where a variant allows.
   */
  prefer?: Record<string, string>
  /** Component property values by property id, such as a boolean that shows a layer. */
  properties?: Record<string, string>
  /** Layers, by path below the island root, shown even where the design hides them. */
  reveal?: string[]
}

/**
 * The variant of the instance's set that shows `required`, and `prefer` too when one does, and
 * otherwise keeps as many of the instance's values as it can.
 */
function variantFor(
  graph: SceneGraph,
  instance: SceneNode,
  required: Record<string, string>,
  prefer: Record<string, string>
): SceneNode | undefined {
  let current = instance.componentId ? graph.getNode(instance.componentId) : undefined
  while (current?.type === 'INSTANCE' && current.componentId)
    current = graph.getNode(current.componentId)
  const set = current?.parentId ? graph.getNode(current.parentId) : undefined
  if (current?.type !== 'COMPONENT' || set?.type !== 'COMPONENT_SET') return undefined
  const values = current.componentPropertyValues
  const variants = graph.getChildren(set.id).filter((variant) => variant.type === 'COMPONENT')
  const showing = (wanted: Record<string, string>) => (variant: SceneNode) =>
    Object.entries(wanted).every(([key, value]) => variant.componentPropertyValues[key] === value)
  const kept = (variant: SceneNode) =>
    Object.entries(values).filter(([key, value]) => variant.componentPropertyValues[key] === value)
      .length
  const best = (candidates: SceneNode[]) =>
    candidates.reduce<SceneNode | undefined>(
      (found, variant) => (!found || kept(variant) > kept(found) ? variant : found),
      undefined
    )
  return (
    best(variants.filter(showing({ ...required, ...prefer }))) ??
    best(variants.filter(showing(required)))
  )
}

/** Let auto layout size a changed layer's ancestors again, not as a `.fig` file recorded them. */
function reflow(graph: SceneGraph, nodeId: string): void {
  let current = graph.getNode(nodeId)
  while (current) {
    if (current.derivedLayout) graph.updateNode(current.id, { derivedLayout: null })
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  }
}

function applyState(
  graph: SceneGraph,
  rootId: string,
  instance: SceneNode,
  state: InstanceState
): void {
  if (state.variants || state.prefer) {
    const variant = variantFor(graph, instance, state.variants ?? {}, state.prefer ?? {})
    if (variant && variant.id !== instance.componentId) {
      // Its layer path names the control, so the instance keeps its name in every variant.
      graph.swapInstanceComponent(instance.id, variant.id, { keepName: true })
      reflow(graph, instance.id)
    }
  }
  for (const [propertyId, value] of Object.entries(state.properties ?? {})) {
    const definition = componentPropertyDefinitions(graph, instance).find(
      (item) => item.id === propertyId
    )
    if (!definition) continue
    applyComponentPropertyValue(graph, instance.id, definition, value)
    reflow(graph, instance.id)
  }
  for (const path of state.reveal ?? []) {
    const layer = findLayerByPath(graph, rootId, path)
    if (layer && !layer.visible) {
      graph.updateNode(layer.id, { visible: true })
      reflow(graph, layer.id)
    }
  }
}

/**
 * A private graph of the layer `rootId` with its instances shown in the given states, by layer
 * path below the root, and laid out again. Outer instances are applied before the layers inside
 * them, since a variant switch rebuilds what an instance contains. The document is untouched.
 */
export function resolvePlayState(
  source: SceneGraph,
  rootId: string,
  states: ReadonlyMap<string, InstanceState>
): SceneGraph {
  // The root's page context with every variant its instances can switch to, reading the
  // document's own variables and images, since a state never changes them.
  const pageId = findPageId(source, rootId) ?? source.rootId
  const graph = extractPageContext(source, pageId, [rootId], {
    componentSets: true,
    shareTables: true
  })
  const ordered = [...states].sort(([a], [b]) => a.split('/').length - b.split('/').length)
  for (const [path, state] of ordered) {
    const instance = findLayerByPath(graph, rootId, path)
    if (instance?.type === 'INSTANCE') applyState(graph, rootId, instance, state)
  }
  computeAllLayouts(graph, rootId)
  return graph
}
