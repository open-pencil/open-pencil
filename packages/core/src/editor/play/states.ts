import {
  applyComponentPropertyValue,
  componentPropertyDefinitions,
  SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

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

function findByPath(graph: SceneGraph, rootId: string, path: string): SceneNode | undefined {
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

/** The root's layers and every component they show, so instances can switch variant. */
function closure(source: SceneGraph, rootId: string): Set<string> {
  const ids = new Set<string>()
  const visit = (id: string) => {
    if (ids.has(id)) return
    const node = source.getNode(id)
    if (!node) return
    ids.add(id)
    for (const child of node.childIds) visit(child)
    if (node.componentId) {
      const component = source.getNode(node.componentId)
      const set = component?.parentId ? source.getNode(component.parentId) : undefined
      visit(set?.type === 'COMPONENT_SET' ? set.id : node.componentId)
    }
  }
  visit(rootId)
  return ids
}

function copyGraph(source: SceneGraph, ids: Set<string>): SceneGraph {
  const graph = new SceneGraph()
  // Fills, images, and bindings resolve against the document's own tables.
  graph.variables = source.variables
  graph.variableCollections = source.variableCollections
  graph.activeMode = source.activeMode
  graph.images = source.images
  graph.documentColorSpace = source.documentColorSpace
  for (const id of ids) {
    const node = source.getNode(id)
    if (!node) continue
    const copy = structuredClone(node)
    graph.nodes.set(id, copy)
    if (copy.type === 'INSTANCE' && copy.componentId) {
      const instances = graph.instanceIndex.get(copy.componentId) ?? new Set<string>()
      instances.add(id)
      graph.instanceIndex.set(copy.componentId, instances)
    }
  }
  return graph
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
      graph.swapInstanceComponent(instance.id, variant.id)
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
    const layer = findByPath(graph, rootId, path)
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
  const graph = copyGraph(source, closure(source, rootId))
  const ordered = [...states].sort(([a], [b]) => a.split('/').length - b.split('/').length)
  for (const [path, state] of ordered) {
    const instance = findByPath(graph, rootId, path)
    if (instance?.type === 'INSTANCE') applyState(graph, rootId, instance, state)
  }
  computeAllLayouts(graph, rootId)
  return graph
}
