import { pick } from 'es-toolkit'

import type { DesignDocument, DesignElement } from '@open-pencil/dom-css'
import { COMPONENT_ATTRIBUTES, isMarked, type LayerSources } from '@open-pencil/dom-css/scene-graph'
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

/** What a set takes from the element that held its variants; its layout stays its own. */
const SET_LOOK = [
  'x',
  'y',
  'width',
  'height',
  'fills',
  'strokes',
  'effects',
  'cornerRadius',
  'independentCorners',
  'topLeftRadius',
  'topRightRadius',
  'bottomRightRadius',
  'bottomLeftRadius',
  'opacity'
] as const satisfies readonly (keyof SceneNode)[]

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
  // The set keeps the box and look of the element that held its variants.
  for (const { id } of variants) {
    const variant = graph.getNode(id)
    if (!variant) continue
    const { x, y } = variant
    graph.updateNode(id, { x: x + set.x - node.x, y: y + set.y - node.y })
  }
  const look = pick(node, SET_LOOK)
  graph.updateNode(set.id, { ...structuredClone(look), name })
  const kept = new Set<string>(SET_LOOK)
  for (const [field, variableId] of Object.entries(node.boundVariables)) {
    // `fills/0/color` is of `fills`.
    if (kept.has(field.split('/')[0])) graph.bindVariable(set.id, field, variableId)
  }
  graph.deleteNode(node.id)
}

/** Refuses a marked element that became no layer of its own, such as a word inside a sentence. */
function requireLayers(sources: LayerSources, page: DesignDocument): void {
  const layered = new Set(sources.values())
  const visit = (parent: DesignDocument | DesignElement) => {
    for (const child of parent.children) {
      if (child.type !== 'element') continue
      const hidden = child.computedStyle?.display === 'none'
      if (hidden) continue
      if (isMarked(child) && !layered.has(child)) {
        throw new Error(`The marked <${child.tagName}> is part of other text and has no layer`)
      }
      visit(child)
    }
  }
  visit(page)
}

/**
 * Makes components, component sets, and component properties of the layers whose elements the
 * page marks with `COMPONENT_ATTRIBUTES`. A property several variants mark is one property of
 * their set, with the first variant's value as its default.
 */
export function createMarkedComponents(
  graph: SceneGraph,
  sources: LayerSources,
  page: DesignDocument
): void {
  requireLayers(sources, page)
  const sets = marked(graph, sources, COMPONENT_ATTRIBUTES.set)
  // Inner components first, so an outer one takes them as they end up.
  const components = marked(graph, sources, COMPONENT_ATTRIBUTES.component).toReversed()
  for (const { node, name } of components) {
    if (!node.parentId) continue
    const component = componentFromNode(graph, node, node.parentId)
    // A layer that cannot become a component is wrapped in one, which paints nothing itself.
    const wrapped = graph.getNode(node.id) !== undefined
    graph.updateNode(component.id, wrapped ? { name, fills: [] } : { name })
    // The layer an element became may have been replaced or wrapped, so its marks follow it.
    const element = sources.get(node.id)
    if (element && !wrapped) {
      sources.delete(node.id)
      sources.set(component.id, element)
    }
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
