import { compact } from 'es-toolkit/array'
import { isPlainObject } from 'es-toolkit/predicate'
import * as v from 'valibot'

import type {
  ComponentPropertyDefinition,
  ComponentPropertyReference,
  SceneGraph,
  SceneNode
} from '@open-pencil/scene-graph'
import {
  applyComponentPropertyValue,
  componentPropertyDefinitions,
  createComponentPropertyId,
  exposableInstances,
  exposedInstances,
  instanceExposureIssue
} from '@open-pencil/scene-graph/components'
import { instanceMainComponent } from '@open-pencil/scene-graph/instances'

import { DESIGN_JSX_SUPPORTED_PROPERTIES } from './definitions'
import { parseScriptInput } from './schema'

const PROPERTY_SYMBOL = Symbol.for('open-pencil.component-property')

/**
 * A component property, by its name in the component that holds it. Where it is placed picks
 * its type: `text` on a text layer makes a TEXT property, `visible` a BOOLEAN one, and `of` on an
 * instance an INSTANCE_SWAP one, whose default is the component that `of` names.
 */
export interface ComponentProperty<T extends string | boolean = string | boolean> {
  readonly [PROPERTY_SYMBOL]: true
  readonly name: string
  readonly defaultValue: T
}

export function isComponentProperty(value: unknown): value is ComponentProperty {
  return typeof value === 'object' && value !== null && PROPERTY_SYMBOL in value
}

/**
 * Bind a field to a property of the component it is drawn in, created on first use: on the
 * component set, for a variant, as Figma keeps them, or else on the component.
 */
export function property<T extends string | boolean>(
  name: string,
  defaultValue: T
): ComponentProperty<T> {
  return Object.freeze({ [PROPERTY_SYMBOL]: true as const, name, defaultValue })
}

/** The prop each property type binds, and the field it binds there. */
const BOUND_PROPS = {
  text: { type: 'TEXT', field: 'TEXT', node: 'TEXT' },
  visible: { type: 'BOOLEAN', field: 'VISIBLE', node: undefined },
  of: { type: 'INSTANCE_SWAP', field: 'INSTANCE_SWAP', node: 'INSTANCE' }
} as const satisfies Record<
  string,
  {
    type: ComponentPropertyDefinition['type']
    field: ComponentPropertyReference['field']
    node: SceneNode['type'] | undefined
  }
>

/** The component, or the set it is a variant of, that holds properties for layers under `parentId`. */
function propertyOwner(graph: SceneGraph, parentId: string): SceneNode {
  let node = graph.getNode(parentId)
  while (node) {
    if (node.type === 'INSTANCE') throw new Error('property() cannot be used inside an instance')
    if (node.type === 'COMPONENT_SET') return node
    if (node.type === 'COMPONENT') {
      const set = node.parentId ? graph.getNode(node.parentId) : undefined
      return set?.type === 'COMPONENT_SET' ? set : node
    }
    node = node.parentId ? graph.getNode(node.parentId) : undefined
  }
  throw new Error('property() must be inside a <Component> or <ComponentSet>')
}

/** The ID of the property with this name on `owner`, added if it has none. */
function ensureDefinition(
  graph: SceneGraph,
  owner: SceneNode,
  name: string,
  type: ComponentPropertyDefinition['type'],
  defaultValue: string
): string {
  const existing = owner.componentPropertyDefinitions.find((item) => item.name === name)
  if (existing) {
    if (existing.type !== type)
      throw new Error(`Component property ${name} is ${existing.type}, not ${type}`)
    if (existing.defaultValue !== defaultValue)
      throw new Error(
        `Component property ${name} has two defaults: ${existing.defaultValue} and ${defaultValue}`
      )
    return existing.id
  }
  const id = createComponentPropertyId()
  graph.updateNode(owner.id, {
    componentPropertyDefinitions: [
      ...owner.componentPropertyDefinitions,
      { id, name, type, defaultValue }
    ]
  })
  return id
}

export interface BoundProperties {
  /** The props, with each property in place of its default. */
  props: Record<string, unknown>
  references: ComponentPropertyReference[]
}

/**
 * Bind the fields a layer's props place a `property()` in, creating the properties on its
 * component; `componentId` gives the ID a swap's default component has.
 */
export function bindProperties(
  graph: SceneGraph,
  source: Record<string, unknown>,
  type: SceneNode['type'],
  parentId: string,
  componentId: ComponentLookup
): BoundProperties {
  if (source.properties !== undefined && type !== 'INSTANCE')
    throw new Error('Only instances accept properties; bind a field to property() instead')
  const props = { ...source }
  const references: ComponentPropertyReference[] = []
  for (const [key, value] of Object.entries(source)) {
    if (!isComponentProperty(value)) continue
    if (!Object.hasOwn(BOUND_PROPS, key))
      throw new Error(`property() binds text, visible, or of, not ${key}`)
    const bound = BOUND_PROPS[key as keyof typeof BOUND_PROPS]
    if (bound.node && bound.node !== type)
      throw new Error(
        `property() in ${key} needs ${bound.node === 'TEXT' ? '<Text>' : '<Instance>'}`
      )
    const expected = bound.type === 'BOOLEAN' ? 'boolean' : 'string'
    if (typeof value.defaultValue !== expected)
      throw new Error(`Component property ${value.name} in ${key} takes a ${expected} default`)
    let defaultValue = String(value.defaultValue)
    if (bound.type === 'INSTANCE_SWAP') {
      const id = componentId(defaultValue)
      if (!id) throw new Error(`<Instance> component not found: ${defaultValue}`)
      defaultValue = id
    }
    const owner = propertyOwner(graph, parentId)
    const propertyId = ensureDefinition(graph, owner, value.name, bound.type, defaultValue)
    references.push({ propertyId, field: bound.field })
    props[key] = value.defaultValue
  }
  return { props, references }
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

/** The ID of the component a name or ID names, as `<Instance of>` finds it. */
export type ComponentLookup = (nameOrId: string) => string | undefined

function assignValue(
  graph: SceneGraph,
  instance: SceneNode,
  definition: ComponentPropertyDefinition,
  key: string,
  value: string,
  componentId: ComponentLookup
): void {
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
    .find(
      (node) =>
        node.type === 'COMPONENT' &&
        Object.entries(wanted).every(([key, value]) => node.componentPropertyValues[key] === value)
    )
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
  const variantNames = new Set(
    componentPropertyDefinitions(graph, nested)
      .filter((definition) => definition.type === 'VARIANT')
      .map((definition) => definition.name)
  )
  const variants = Object.fromEntries(
    Object.entries(values)
      .filter(([key]) => variantNames.has(key))
      .map(([key, value]) => [key, String(value)])
  )
  selectNestedVariant(graph, nested, name, variants)
  const definitions = componentPropertyDefinitions(graph, nested)
  for (const [key, value] of Object.entries(values)) {
    if (variantNames.has(key)) continue
    const definition = namedDefinition(definitions, key)
    if (!definition) throw new Error(`Unknown component property on ${name}: ${key}`)
    assignValue(graph, nested, definition, key, String(value), componentId)
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
    if (typeof value !== 'string' && typeof value !== 'boolean' && typeof value !== 'number')
      throw new Error(`Expected a string or boolean for component property: ${key}`)
    assignValue(graph, instance, definition, key, String(value), componentId)
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
  const assignments = parseScriptInput(
    'Invalid properties on <Instance>',
    v.record(v.string(), v.union([assignedValueSchema, exposedValuesSchema])),
    input
  )
  const definitions = componentPropertyDefinitions(graph, instance)
  for (const [key, value] of Object.entries(assignments)) {
    if (isPlainObject(value)) {
      assignExposedInstance(graph, instance, key, value, componentId)
      continue
    }
    const definition =
      definitions.find((item) => item.id === key) ?? namedDefinition(definitions, key)
    if (!definition) throw new Error(`Unknown component property: ${key}`)
    assignValue(graph, instance, definition, key, String(value), componentId)
  }
}

/** Mark an instance in a component's layers as exposed, under Figma's rules for exposing one. */
export function exposeInstance(graph: SceneGraph, instance: SceneNode): void {
  const issue = instanceExposureIssue(graph, instance)
  if (issue === 'not-in-component') throw new Error('exposed needs an <Instance> in a component')
  if (issue === 'not-primary')
    throw new Error('exposed needs an <Instance> in a component, not inside another instance')
  if (issue === 'nothing-to-expose')
    throw new Error(`${instance.name} has no properties or exposed instances to expose`)
  graph.updateNode(instance.id, { isExposedInstance: true })
}

/** The names an instance of `component` takes: its properties' and its exposed instances'. */
export function componentPropNames(graph: SceneGraph, component: SceneNode): string[] {
  return [
    ...(componentPropertyScope(graph, component.id) ?? []).map((definition) => definition.name),
    ...exposableInstances(graph, component.id)
      .filter((node) => node.isExposedInstance)
      .map((node) => node.name)
  ]
}

function parseVariantValues(name: string): Record<string, string> {
  const entries = compact(name.split(',').map((part) => part.trim()))
  const values: Record<string, string> = {}
  for (const entry of entries) {
    const [key = '', ...rest] = entry.split('=')
    const property = key.trim()
    const value = rest.join('=').trim()
    if (property && value) values[property] = value
  }
  return values
}

/** Variant properties a component set takes from its variants' names, such as `State=On`. */
export function inferComponentSetProperties(graph: SceneGraph, componentSetId: string): void {
  const componentSet = graph.getNode(componentSetId)
  if (componentSet?.type !== 'COMPONENT_SET') return
  const existingDefinitions = componentSet.componentPropertyDefinitions

  const variants = graph.getChildren(componentSetId).filter((node) => node.type === 'COMPONENT')
  const options = new Map<string, Set<string>>()
  const valuesById = new Map<string, Record<string, string>>()

  for (const variant of variants) {
    const values = parseVariantValues(variant.name)
    valuesById.set(variant.id, values)
    for (const [property, value] of Object.entries(values)) {
      let set = options.get(property)
      if (!set) {
        set = new Set()
        options.set(property, set)
      }
      set.add(value)
    }
  }

  const definitions: ComponentPropertyDefinition[] = [...options.entries()]
    .filter(
      ([name]) =>
        !existingDefinitions.some(
          (definition) => definition.type === 'VARIANT' && definition.name === name
        )
    )
    .map(([name, values]) => {
      const variantOptions = [...values]
      return {
        id: createComponentPropertyId(),
        name,
        type: 'VARIANT',
        defaultValue: variantOptions[0] ?? '',
        variantOptions
      }
    })

  for (const [id, values] of valuesById) {
    graph.updateNode(id, { componentPropertyValues: values })
  }
  graph.updateNode(componentSetId, {
    componentPropertyDefinitions: [...existingDefinitions, ...definitions]
  })
}
