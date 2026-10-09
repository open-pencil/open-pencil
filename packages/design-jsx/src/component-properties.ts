import * as v from 'valibot'

import { applyComponentPropertyValue, componentPropertyDefinitions } from '@open-pencil/scene-graph'
import type {
  ComponentPropertyDefinition,
  ComponentPropertyReference,
  SceneGraph,
  SceneNode
} from '@open-pencil/scene-graph'

import { parseScriptInput } from './validation'

const definitionSchema = v.object({
  id: v.string(),
  name: v.string(),
  type: v.picklist(['VARIANT', 'TEXT', 'BOOLEAN', 'INSTANCE_SWAP']),
  defaultValue: v.string(),
  variantOptions: v.optional(v.array(v.string())),
  preferredValues: v.optional(v.array(v.string()))
}) satisfies v.GenericSchema<ComponentPropertyDefinition>
const referenceSchema = v.object({
  propertyId: v.string(),
  field: v.picklist(['VISIBLE', 'TEXT', 'INSTANCE_SWAP'])
}) satisfies v.GenericSchema<ComponentPropertyReference>

/** Accept the native graph contracts, without introducing a second property model. */
export function componentMetadata(
  props: Record<string, unknown>,
  type: SceneNode['type'],
  definitions?: readonly ComponentPropertyDefinition[]
): Partial<SceneNode> {
  const result: Partial<SceneNode> = {}
  if (props.properties !== undefined && type !== 'INSTANCE') {
    if (type !== 'COMPONENT' && type !== 'COMPONENT_SET')
      throw new Error('Only components, component sets, and instances accept properties')
    const definitions = parseScriptInput(
      'Invalid properties',
      v.array(definitionSchema),
      props.properties
    )
    if (new Set(definitions.map((definition) => definition.id)).size !== definitions.length)
      throw new Error('Duplicate component property IDs')
    const variantNames = definitions
      .filter((item) => item.type === 'VARIANT')
      .map((item) => item.name)
    if (new Set(variantNames).size !== variantNames.length)
      throw new Error('Duplicate variant property names')
    result.componentPropertyDefinitions = definitions
  }
  if (props.propertyRefs !== undefined) {
    const references = parseScriptInput(
      'Invalid propertyRefs',
      v.array(referenceSchema),
      props.propertyRefs
    )
    for (const reference of references) {
      if (reference.field === 'TEXT' && type !== 'TEXT')
        throw new Error('TEXT properties require a text node')
      if (reference.field === 'INSTANCE_SWAP' && type !== 'INSTANCE')
        throw new Error('INSTANCE_SWAP properties require an instance')
      if (definitions) {
        const definition = definitions.find((item) => item.id === reference.propertyId)
        if (!definition)
          throw new Error(`Unknown component property reference: ${reference.propertyId}`)
        const expectedField = definition.type === 'BOOLEAN' ? 'VISIBLE' : definition.type
        if (reference.field !== expectedField)
          throw new Error(`Component property ${definition.id} cannot bind ${reference.field}`)
      }
    }
    result.componentPropertyReferences = references
  }
  return result
}

/** Match the nearest component scope, including definitions inherited from its set. */
export function componentPropertyScope(
  graph: SceneGraph,
  parentId: string
): readonly ComponentPropertyDefinition[] | undefined {
  let parent = graph.getNode(parentId)
  while (parent) {
    if (parent.type === 'INSTANCE') return componentPropertyDefinitions(graph, parent)
    if (parent.type === 'COMPONENT_SET') return parent.componentPropertyDefinitions
    if (parent.type === 'COMPONENT') {
      const set = parent.parentId ? graph.getNode(parent.parentId) : undefined
      return set?.type === 'COMPONENT_SET'
        ? [...set.componentPropertyDefinitions, ...parent.componentPropertyDefinitions]
        : parent.componentPropertyDefinitions
    }
    parent = parent.parentId ? graph.getNode(parent.parentId) : undefined
  }
  return undefined
}

/**
 * Saving to `.fig` replaces authored property IDs with GUIDs, so an assignment
 * also matches one property by name, ignoring case, to keep working after a reload.
 */
function assignedDefinition(
  definitions: readonly ComponentPropertyDefinition[],
  key: string
): ComponentPropertyDefinition {
  const byId = definitions.find((item) => item.id === key)
  if (byId) return byId
  const name = key.toLowerCase()
  const byName = definitions.filter((item) => item.name.toLowerCase() === name)
  if (byName.length === 1) return byName[0]
  if (byName.length > 1)
    throw new Error(
      `Component property name ${key} is ambiguous; use one of the IDs: ${byName.map((item) => item.id).join(', ')}`
    )
  throw new Error(`Unknown component property: ${key}`)
}

export function assignComponentProperties(
  graph: SceneGraph,
  instance: SceneNode,
  input: unknown
): void {
  if (input === undefined) return
  const assignments = parseScriptInput(
    'Invalid properties on <Instance>',
    v.record(v.string(), v.string()),
    input
  )
  const definitions = componentPropertyDefinitions(graph, instance)
  for (const [id, value] of Object.entries(assignments)) {
    const definition = assignedDefinition(definitions, id)
    if (definition.type === 'VARIANT')
      throw new Error('Select a component-set variant when creating the instance')
    if (definition.type === 'BOOLEAN' && value !== 'true' && value !== 'false')
      throw new Error(`Expected true or false for component property: ${id}`)
    if (!applyComponentPropertyValue(graph, instance.id, definition, value))
      throw new Error(`Cannot assign component property: ${id}`)
  }
}
