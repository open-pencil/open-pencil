import { COMPONENT_ATTRIBUTES, type LayerSources } from '@open-pencil/dom-css/scene-graph'
import type {
  ComponentPropertyDefinition,
  ComponentPropertyReference,
  SceneGraph,
  SceneNode
} from '@open-pencil/scene-graph'
import { createComponentPropertyId } from '@open-pencil/scene-graph/components'
import { createSlotProperty, slotOwner } from '@open-pencil/scene-graph/slots'

import { componentFromNode } from '#core/figma-api/components'
import { combineComponentsAsVariants } from '#core/figma-api/variants'

interface Marked {
  node: SceneNode
  name: string
}

function marked(graph: SceneGraph, sources: LayerSources, attribute: string): Marked[] {
  const found: Marked[] = []
  for (const [nodeId, element] of sources) {
    const name = element.attrs[attribute]?.trim()
    const node = name ? graph.getNode(nodeId) : undefined
    // A text layer inside a box shares its element; the box is what the page marked.
    const parent = node?.parentId ? sources.get(node.parentId) : undefined
    if (node && parent !== element) found.push({ node, name })
  }
  return found
}

function bindProperty(
  graph: SceneGraph,
  node: SceneNode,
  property: Pick<ComponentPropertyDefinition, 'name' | 'type' | 'defaultValue'>,
  field: ComponentPropertyReference['field']
): void {
  const owner = slotOwner(graph, node)
  if (!owner) {
    throw new Error(`The property ${property.name} is marked outside a component`)
  }
  const known = owner.componentPropertyDefinitions.find(({ name }) => name === property.name)
  if (known && known.type !== property.type) {
    throw new Error(`${owner.name} has both a ${known.type} and a ${property.type} ${known.name}`)
  }
  const propertyId = known?.id ?? createComponentPropertyId()
  if (!known) {
    graph.updateNode(owner.id, {
      componentPropertyDefinitions: [
        ...owner.componentPropertyDefinitions,
        { id: propertyId, ...property }
      ]
    })
  }
  graph.updateNode(node.id, {
    componentPropertyReferences: [...node.componentPropertyReferences, { propertyId, field }]
  })
}

/** The text layer an element's text is: its own layer, or the only one in its box. */
function textLayer(graph: SceneGraph, node: SceneNode): SceneNode {
  if (node.type === 'TEXT') return node
  const texts = graph.getChildren(node.id).filter((child) => child.type === 'TEXT')
  if (texts.length !== 1) throw new Error(`${node.name} needs one text layer to bind its text`)
  return texts[0]
}

function bindSlot(graph: SceneGraph, node: SceneNode, name: string): void {
  if (node.type !== 'FRAME') throw new Error(`The slot ${name} needs an element with a box`)
  const known = slotOwner(graph, node)?.componentPropertyDefinitions.find(
    (definition) => definition.name === name
  )
  if (known) {
    bindProperty(graph, node, { name, type: 'SLOT', defaultValue: '' }, 'SLOT_CONTENT')
    return
  }
  graph.updateNode(node.id, { name })
  if (!createSlotProperty(graph, node.id, createComponentPropertyId())) {
    throw new Error(`The slot ${name} is marked outside a component`)
  }
}

function createSet(graph: SceneGraph, { node, name }: Marked): void {
  const variants = graph.getChildren(node.id).filter((child) => child.type === 'COMPONENT')
  const { parentId } = node
  if (variants.length === 0 || !parentId) {
    throw new Error(`The component set ${name} has no components directly inside it`)
  }
  if (variants.length !== node.childIds.length) {
    throw new Error(`The component set ${name} holds more than its components`)
  }
  const index = graph.getNode(parentId)?.childIds.indexOf(node.id)
  const set = combineComponentsAsVariants(
    graph,
    variants.map((variant) => variant.id),
    parentId,
    index
  )
  graph.updateNode(set.id, { name })
  graph.deleteNode(node.id)
}

/**
 * Makes components, component sets, and component properties of the layers whose elements the
 * page marks with `COMPONENT_ATTRIBUTES`. A property several variants mark is one property of
 * their set, with the first variant's value as its default.
 */
export function createMarkedComponents(graph: SceneGraph, sources: LayerSources): void {
  const sets = marked(graph, sources, COMPONENT_ATTRIBUTES.set)
  // Inner components first, so an outer one takes them as they end up.
  const components = marked(graph, sources, COMPONENT_ATTRIBUTES.component).toReversed()
  for (const { node, name } of components) {
    if (!node.parentId) continue
    const component = componentFromNode(graph, node, node.parentId)
    graph.updateNode(component.id, { name })
  }
  for (const set of sets) createSet(graph, set)

  for (const { node, name } of marked(graph, sources, COMPONENT_ATTRIBUTES.text)) {
    const layer = textLayer(graph, node)
    bindProperty(graph, layer, { name, type: 'TEXT', defaultValue: layer.text }, 'TEXT')
  }
  for (const { node, name } of marked(graph, sources, COMPONENT_ATTRIBUTES.visible)) {
    const defaultValue = String(node.visible)
    bindProperty(graph, node, { name, type: 'BOOLEAN', defaultValue }, 'VISIBLE')
  }
  for (const { node, name } of marked(graph, sources, COMPONENT_ATTRIBUTES.slot)) {
    bindSlot(graph, node, name)
  }
}
