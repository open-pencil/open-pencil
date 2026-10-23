import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { behaviourProperties } from '@open-pencil/scene-graph/behaviours'
import { restingVariant } from '@open-pencil/scene-graph/components'

import type { ComponentMapping, ComponentMappingArgs } from './schema'

export function savedMappingNode(graph: SceneGraph, id: string): SceneNode {
  const found = Array.from(graph.getAllNodes()).filter((node) => node.source.id === id)
  if (found.length !== 1)
    throw new Error(
      `Expected one layer with saved FIG ID ${id}; found ${found.length}. The layer may have been deleted or recreated. Use --mapping-info to inspect saved identities.`
    )
  return found[0]
}

export function mappingComponent(graph: SceneGraph, mapping: ComponentMapping): SceneNode {
  const node = savedMappingNode(graph, mapping.design.id)
  if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET')
    throw new Error(
      `Mapping ${mapping.key} targets ${node.type}; select a component or component set.`
    )
  return node
}

export function mappingDefault(graph: SceneGraph, component: SceneNode): SceneNode {
  const node = component.type === 'COMPONENT_SET' ? restingVariant(graph, component) : component
  if (!node) throw new Error(`Component ${component.source.id} has no default variant.`)
  return node
}

/** Resolve mapped values by persistent property ID; names only look up a variant's values. */
export function mappingArgs(
  graph: SceneGraph,
  component: SceneNode,
  variant: SceneNode,
  mapping: ComponentMapping,
  overrides: ComponentMappingArgs = {}
): ComponentMappingArgs {
  const definitions = behaviourProperties(graph, component)
  const entries = Object.entries(mapping.props).map(([id, property]) => {
    const definition =
      variant.componentPropertyDefinitions.find((candidate) => candidate.id === id) ??
      definitions.find((candidate) => candidate.id === id)
    if (!definition)
      throw new Error(
        `Mapping ${mapping.key}: saved property ${id} no longer exists. Use --mapping-info to inspect properties.`
      )
    if (!['VARIANT', 'TEXT', 'BOOLEAN'].includes(definition.type))
      throw new Error(
        `Mapping ${mapping.key}: ${definition.type} property ${id} needs an explicit implementation fixture instead of scalar prop mapping.`
      )
    let value = definition.defaultValue
    if (Object.hasOwn(variant.componentPropertyAssignments, id))
      value = variant.componentPropertyAssignments[id]
    if (Object.hasOwn(variant.componentPropertyValues, definition.name))
      value = variant.componentPropertyValues[definition.name]
    let result: ComponentMappingArgs[string] = value
    if (property.values) {
      if (!Object.hasOwn(property.values, value))
        throw new Error(
          `Mapping ${mapping.key}: property ${id} has no implementation value for ${JSON.stringify(value)}.`
        )
      result = property.values[value]
    } else if (definition.type === 'BOOLEAN') {
      if (value !== 'true' && value !== 'false')
        throw new Error(`Mapping ${mapping.key}: property ${id} has an invalid boolean value.`)
      result = value === 'true'
    }
    if (Object.hasOwn(overrides, property.prop) && overrides[property.prop] !== result)
      throw new Error(
        `Mapping ${mapping.key}: state arg ${property.prop} disagrees with the selected design variant.`
      )
    return [property.prop, result]
  })
  return { ...Object.fromEntries(entries), ...overrides }
}

export function mappingState(graph: SceneGraph, component: SceneNode, id: string): SceneNode {
  const node = savedMappingNode(graph, id)
  if (
    component.type !== 'COMPONENT_SET' ||
    node.type !== 'COMPONENT' ||
    node.parentId !== component.id
  )
    throw new Error(`Saved state ${id} is not a variant of component ${component.source.id}.`)
  return node
}
