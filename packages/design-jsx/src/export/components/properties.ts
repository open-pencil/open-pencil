import type {
  ComponentPropertyDefinition,
  ComponentPropertyReference,
  SceneGraph,
  SceneNode
} from '@open-pencil/scene-graph'
import { readBehaviour } from '@open-pencil/scene-graph/behaviours'

import { helperCall, type JSXProp, type JSXValue } from '../value'
import type { ComponentReference } from './references'

/**
 * The component whose properties a layer's fields bind, as `property()` finds it: the set, for
 * a variant. None for a layer outside a main component or inside an instance, whose bindings
 * are its component's.
 */
function propertyOwner(graph: SceneGraph, node: SceneNode): SceneNode | undefined {
  let parent = node.parentId ? graph.getNode(node.parentId) : undefined
  while (parent) {
    if (parent.type === 'INSTANCE') return undefined
    if (parent.type === 'COMPONENT_SET') return parent
    if (parent.type === 'COMPONENT') {
      const set = parent.parentId ? graph.getNode(parent.parentId) : undefined
      return set?.type === 'COMPONENT_SET' ? set : parent
    }
    parent = parent.parentId ? graph.getNode(parent.parentId) : undefined
  }
  return undefined
}

/** The prop a reference binds, as `property()` is written in it. */
const BOUND_PROPS: Partial<Record<ComponentPropertyReference['field'], string>> = {
  TEXT: 'text',
  VISIBLE: 'visible',
  INSTANCE_SWAP: 'of'
}

function defaultValue(
  graph: SceneGraph,
  definition: ComponentPropertyDefinition,
  reference: ComponentReference
): JSXValue {
  if (definition.type === 'BOOLEAN') return definition.defaultValue === 'true'
  if (definition.type !== 'INSTANCE_SWAP') return definition.defaultValue
  const component = graph.getNode(definition.defaultValue)
  return component ? reference.of(component) : definition.defaultValue
}

/** `props` with each field bound to a component property written as the binding instead. */
export function withPropertyBindings(
  props: JSXProp[],
  node: SceneNode,
  graph: SceneGraph,
  reference: ComponentReference
): JSXProp[] {
  const bound = propertyBindingProps(node, graph, reference)
  return [...props.filter(([name]) => !bound.some(([key]) => key === name)), ...bound]
}

/**
 * The fields of a main component's layer bound to its properties, as `property()` calls:
 * `text={property('Label', 'Hi')}`. A Reka text field's text and a part's slot are left to
 * the Reka elements, which bind them.
 */
export function propertyBindingProps(
  node: SceneNode,
  graph: SceneGraph,
  reference: ComponentReference
): JSXProp[] {
  if (node.componentPropertyReferences.length === 0) return []
  const owner = propertyOwner(graph, node)
  if (!owner) return []
  const rekaTexts = new Set(
    Object.values(readBehaviour(owner)?.texts ?? {}).map((binding) => binding.propertyId)
  )
  const props: JSXProp[] = []
  for (const { propertyId, field } of node.componentPropertyReferences) {
    const prop = BOUND_PROPS[field]
    const definition = owner.componentPropertyDefinitions.find((item) => item.id === propertyId)
    if (!prop || !definition || rekaTexts.has(propertyId)) continue
    props.push([
      prop,
      helperCall('property', definition.name, defaultValue(graph, definition, reference))
    ])
  }
  return props
}
