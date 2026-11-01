import { isPlainObject, mapValues, omit, omitBy, pick, pickBy } from 'es-toolkit'
import * as v from 'valibot'

import type { ComponentPropertyDefinition, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  applyComponentPropertyValue,
  componentPropertyDefinitions,
  exposedInstances
} from '@open-pencil/scene-graph/components'
import { instanceMainComponent } from '@open-pencil/scene-graph/instances'

import { DESIGN_JSX_SUPPORTED_PROPERTIES } from '../definitions'
import { isLayerRef, type LayerRef } from '../refs'
import { parseScriptInput } from '../schema'
import { hasVariantValues, type ComponentLookup } from './properties'

/** The one property with this name; a name several properties share is an error. */
function namedDefinition(
  definitions: readonly ComponentPropertyDefinition[],
  name: string
): ComponentPropertyDefinition | undefined {
  const matches = definitions.filter((item) => item.name === name)
  if (matches.length > 1)
    throw new Error(
      `Component property name ${name} is ambiguous; use one of the IDs: ${matches.map((item) => item.id).join(', ')}`
    )
  return matches[0]
}

/** A value as an assignment takes it: a swap's `ref()` as it is, anything else as text. */
function assignable(value: unknown): string | LayerRef {
  return isLayerRef(value) ? value : String(value)
}

function assignValue(
  graph: SceneGraph,
  instance: SceneNode,
  definition: ComponentPropertyDefinition,
  key: string,
  value: string | LayerRef,
  componentId: ComponentLookup
): void {
  if (isLayerRef(value)) {
    if (definition.type !== 'INSTANCE_SWAP')
      throw new Error(`A ref() names a component, for a swap property, not ${key}`)
    const id = componentId(value)
    if (!id) throw new Error(`${key} names a ref() that marks no component rendered before it`)
    if (!applyComponentPropertyValue(graph, instance.id, definition, id))
      throw new Error(`Cannot assign component property: ${key}`)
    return
  }
  if (definition.type === 'VARIANT')
    throw new Error('Select a component-set variant when creating the instance')
  if (definition.type === 'BOOLEAN' && value !== 'true' && value !== 'false')
    throw new Error(`Expected true or false for component property: ${key}`)
  // A swap names its component as `of` does: by ID or by name.
  const assigned = definition.type === 'INSTANCE_SWAP' ? (componentId(value) ?? value) : value
  if (!applyComponentPropertyValue(graph, instance.id, definition, assigned))
    throw new Error(`Cannot assign component property: ${key}`)
}

/** A value an instance gives a property, or an exposed nested instance's values by name. */
const assignedValueSchema = v.union([v.string(), v.boolean(), v.number()])
const exposedValuesSchema = v.record(v.string(), assignedValueSchema)

/** The one exposed nested instance with this name; a name several share is an error. */
function exposedInstanceNamed(
  graph: SceneGraph,
  instance: SceneNode,
  name: string
): SceneNode | undefined {
  const matches = exposedInstances(graph, instance).filter((node) => node.name === name)
  if (matches.length > 1)
    throw new Error(`Exposed instance name ${name} is shared by ${matches.length} layers`)
  return matches[0]
}

/**
 * Pick the variant of an exposed instance's set that has the values it names, keeping its own
 * for the rest, as its panel group does.
 */
function selectNestedVariant(
  graph: SceneGraph,
  nested: SceneNode,
  name: string,
  values: Record<string, string>
): void {
  if (Object.keys(values).length === 0) return
  const component = instanceMainComponent(graph, nested)
  const set = component?.parentId ? graph.getNode(component.parentId) : undefined
  if (!component || set?.type !== 'COMPONENT_SET') return
  const wanted = { ...component.componentPropertyValues, ...values }
  const variant = graph
    .getChildren(set.id)
    .find((node) => node.type === 'COMPONENT' && hasVariantValues(node, wanted))
  if (!variant)
    throw new Error(
      `${name} has no variant ${Object.entries(values)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ')}`
    )
  if (variant.id !== component.id) graph.swapInstanceComponent(nested.id, variant.id)
}

/**
 * Give the exposed nested instance named `name` its values: variants and properties by name,
 * the way the instance itself takes them.
 */
function assignExposedInstance(
  graph: SceneGraph,
  instance: SceneNode,
  name: string,
  input: unknown,
  componentId: ComponentLookup
): void {
  const nested = exposedInstanceNamed(graph, instance, name)
  if (!nested) throw new Error(`Unknown component property or exposed instance: ${name}`)
  const values = parseScriptInput(`Invalid values for ${name}`, exposedValuesSchema, input)
  const variantNames = componentPropertyDefinitions(graph, nested)
    .filter((definition) => definition.type === 'VARIANT')
    .map((definition) => definition.name)
  selectNestedVariant(graph, nested, name, mapValues(pick(values, variantNames), String))
  const definitions = componentPropertyDefinitions(graph, nested)
  for (const [key, value] of Object.entries(omit(values, variantNames))) {
    const definition = namedDefinition(definitions, key)
    if (!definition) throw new Error(`Unknown component property on ${name}: ${key}`)
    assignValue(graph, nested, definition, key, assignable(value), componentId)
  }
}

/**
 * Set text, boolean, and swap properties an instance names as props, as in `Title="Hello"`, the
 * way it picks a variant, and an exposed nested instance's values, as in `Action={{ Label: 'Save' }}`;
 * design JSX props keep their meaning.
 */
export function assignNamedProperties(
  graph: SceneGraph,
  instance: SceneNode,
  props: Record<string, unknown>,
  componentId: ComponentLookup
): void {
  const definitions = componentPropertyDefinitions(graph, instance).filter(
    (definition) => definition.type !== 'VARIANT'
  )
  for (const [key, value] of Object.entries(props)) {
    if (DESIGN_JSX_SUPPORTED_PROPERTIES.has(key)) continue
    if (isPlainObject(value) && exposedInstanceNamed(graph, instance, key)) {
      assignExposedInstance(graph, instance, key, value, componentId)
      continue
    }
    const definition = namedDefinition(definitions, key)
    if (!definition) continue
    if (
      typeof value !== 'string' &&
      typeof value !== 'boolean' &&
      typeof value !== 'number' &&
      !isLayerRef(value)
    )
      throw new Error(`Expected a string, boolean, or ref() for component property: ${key}`)
    assignValue(graph, instance, definition, key, assignable(value), componentId)
  }
}

/**
 * Keys are property IDs or, because saving to `.fig` replaces authored IDs
 * with GUIDs, names, which survive a reload; an object gives an exposed nested instance its values.
 */
export function assignComponentProperties(
  graph: SceneGraph,
  instance: SceneNode,
  input: unknown,
  componentId: ComponentLookup
): void {
  if (input === undefined) return
  // A swap's ref() is not data to validate; it is kept as it is.
  const refs = isPlainObject(input) ? pickBy(input, (value) => isLayerRef(value)) : {}
  const assignments = {
    ...parseScriptInput(
      'Invalid properties on <Instance>',
      v.record(v.string(), v.union([assignedValueSchema, exposedValuesSchema])),
      isPlainObject(input) ? omitBy(input, (value) => isLayerRef(value)) : input
    ),
    ...refs
  }
  const definitions = componentPropertyDefinitions(graph, instance)
  for (const [key, value] of Object.entries(assignments)) {
    if (isPlainObject(value)) {
      assignExposedInstance(graph, instance, key, value, componentId)
      continue
    }
    const definition =
      definitions.find((item) => item.id === key) ?? namedDefinition(definitions, key)
    if (!definition) throw new Error(`Unknown component property: ${key}`)
    assignValue(graph, instance, definition, key, assignable(value), componentId)
  }
}
