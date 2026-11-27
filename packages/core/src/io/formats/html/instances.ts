import { isEqual, omit, pick } from 'es-toolkit'

import type { DesignElement } from '@open-pencil/dom-css'
import { COMPONENT_ATTRIBUTES, type LayerSources } from '@open-pencil/dom-css/scene-graph'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { recordInstanceOverride } from '@open-pencil/scene-graph/instances'
import { parseVariantName } from '@open-pencil/scene-graph/variant-name'

/** What a layer looks like apart from its text and its size, which an instance can override. */
const LOOK = [
  'type',
  'visible',
  'opacity',
  'fills',
  'strokes',
  'effects',
  'strokeWeight',
  'cornerRadius',
  'topLeftRadius',
  'topRightRadius',
  'bottomRightRadius',
  'bottomLeftRadius',
  'vectorNetwork',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'italic',
  'lineHeight',
  'letterSpacing',
  'boundVariables'
] as const satisfies readonly (keyof SceneNode)[]

/** Where a layer sits in its parent and how it sizes there, which its instance takes over. */
const PLACEMENT = [
  'x',
  'y',
  'width',
  'height',
  'layoutPositioning',
  'layoutGrow',
  'layoutAlignSelf',
  'primaryAxisSizing',
  'counterAxisSizing'
] as const satisfies readonly (keyof SceneNode)[]

/**
 * Whether `layer` draws what the component `main` draws, but for its text and its size: the
 * same layers in the same order, each looking the same.
 */
function drawsAs(graph: SceneGraph, layer: SceneNode, main: SceneNode, root = true): boolean {
  // A layer that becomes a component has its strokes' line caps and joins written out.
  const look = (node: SceneNode) => ({
    ...pick(node, LOOK),
    strokes: node.strokes.map((stroke) => omit(stroke, ['cap', 'join']))
  })
  // The page's element is a frame where the component is the component itself.
  const same = root
    ? isEqual({ ...look(layer), type: 'COMPONENT' }, look(main))
    : isEqual(look(layer), look(main))
  if (!same) return false
  const children = graph.getChildren(layer.id)
  const mains = graph.getChildren(main.id)
  return (
    children.length === mains.length &&
    children.every((child, index) => drawsAs(graph, child, mains[index], false))
  )
}

/** Where a layer is and how big, as the page laid it out. */
const GEOMETRY = ['x', 'y', 'width', 'height'] as const satisfies readonly (keyof SceneNode)[]

/**
 * Gives each layer of the instance what the page's layer had there: its text, as an override,
 * and where the page laid it out, which its text and the instance's size decide.
 */
function takeOver(graph: SceneGraph, layer: SceneNode, copy: SceneNode): void {
  if (copy.type === 'TEXT' && copy.text !== layer.text) {
    graph.updateNode(copy.id, { text: layer.text })
    recordInstanceOverride(graph, copy.id, ['text'])
  }
  const children = graph.getChildren(layer.id)
  graph.getChildren(copy.id).forEach((child, index) => {
    const own = children.at(index)
    if (!own) return
    graph.updateNode(child.id, pick(own, GEOMETRY))
    takeOver(graph, own, child)
  })
}

/** The main component an element names: a component, or the variant of a set its values pick. */
function namedComponent(
  graph: SceneGraph,
  element: DesignElement
): { main: SceneNode | undefined; name: string } {
  const name = element.attrs[COMPONENT_ATTRIBUTES.instance].trim()
  const owner = [...graph.getAllNodes()].find(
    (node) => (node.type === 'COMPONENT_SET' || node.type === 'COMPONENT') && node.name === name
  )
  if (!owner) throw new Error(`The page marks an instance of ${name}, which it marks no component`)
  if (owner.type === 'COMPONENT') return { main: owner, name }
  const values = parseVariantName(element.attrs[COMPONENT_ATTRIBUTES.variant] ?? '')
  const main = graph
    .getChildren(owner.id)
    .find((variant) => isEqual(variant.componentPropertyValues, values))
  return { main, name }
}

/**
 * Makes each layer the page marks as an instance of one of its components an instance of it,
 * where the layer draws what that component, or the variant of a set its `variant` mark picks,
 * draws but for its text and size: the instance takes the layer's place and size, and its text
 * as overrides. A layer that draws something else, such as a button with an icon its variant
 * lacks, or that names a variant the set does not have, stays the layers it is.
 */
export function createMarkedInstances(graph: SceneGraph, sources: LayerSources): void {
  for (const [nodeId, element] of sources) {
    // An element the page makes a component is that component, not an instance of another.
    const marks = element.attrs
    if (!Object.hasOwn(marks, COMPONENT_ATTRIBUTES.instance)) continue
    if (Object.hasOwn(marks, COMPONENT_ATTRIBUTES.component)) continue
    // An instance an outer one replaced is gone with it; a text layer shares its box's element.
    const layer = graph.getNode(nodeId)
    const parent = layer?.parentId ? graph.getNode(layer.parentId) : undefined
    if (!layer || !parent || sources.get(parent.id) === element) continue
    const { main } = namedComponent(graph, element)
    if (!main || !drawsAs(graph, layer, main)) continue
    const instance = graph.createInstance(main.id, parent.id, pick(layer, PLACEMENT))
    if (!instance) continue
    graph.insertChildAt(instance.id, parent.id, parent.childIds.indexOf(layer.id))
    takeOver(graph, layer, instance)
    graph.deleteNode(layer.id)
    sources.delete(layer.id)
  }
}
