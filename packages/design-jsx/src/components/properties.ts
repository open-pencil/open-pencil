import { compact, groupBy, isEqual, pick, uniq } from 'es-toolkit'

import type {
  ComponentPropertyDefinition,
  ComponentPropertyReference,
  SceneGraph,
  SceneNode
} from '@open-pencil/scene-graph'
import {
  componentPropertyDefinitions,
  createComponentPropertyId,
  exposableInstances,
  instanceExposureIssue
} from '@open-pencil/scene-graph/components'

import { isLayerRef, type LayerRef } from '../refs'

const PROPERTY_SYMBOL = Symbol.for('open-pencil.component-property')

/**
 * A component property, by its name in the component that holds it. Where it is placed picks
 * its type: `text` on a text layer makes a TEXT property, `visible` a BOOLEAN one, and `of` on an
 * instance an INSTANCE_SWAP one, whose default is the component that `of` names: by name, ID,
 * or the `ref()` that marks it.
 */
export interface ComponentProperty<
  T extends string | boolean | LayerRef = string | boolean | LayerRef
> {
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
export function property<T extends string | boolean | LayerRef>(
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
  defaultValue: string,
  added: string[] | undefined
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
  added?.push(id)
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
 * component; `componentId` gives the ID a swap's default component has, and `added` takes the
 * IDs of the properties it creates.
 */
export function bindProperties(
  graph: SceneGraph,
  source: Record<string, unknown>,
  type: SceneNode['type'],
  parentId: string,
  componentId: ComponentLookup,
  added?: string[]
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
    const swapRef = bound.type === 'INSTANCE_SWAP' && isLayerRef(value.defaultValue)
    if (!swapRef && typeof value.defaultValue !== expected)
      throw new Error(`Component property ${value.name} in ${key} takes a ${expected} default`)
    let defaultValue = isLayerRef(value.defaultValue) ? '' : String(value.defaultValue)
    if (bound.type === 'INSTANCE_SWAP') {
      const id = componentId(isLayerRef(value.defaultValue) ? value.defaultValue : defaultValue)
      if (!id) throw new Error(`<Instance> component not found: ${defaultValue || 'ref()'}`)
      defaultValue = id
    }
    const owner = propertyOwner(graph, parentId)
    const propertyId = ensureDefinition(graph, owner, value.name, bound.type, defaultValue, added)
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

/** Whether a variant has every value `wanted` names, by variant property. */
export function hasVariantValues(variant: SceneNode, wanted: Record<string, string>): boolean {
  return isEqual(pick(variant.componentPropertyValues, Object.keys(wanted)), wanted)
}

/** The ID of the component a name, ID, or `ref()` names, as `<Instance of>` finds it. */
export type ComponentLookup = (reference: string | LayerRef) => string | undefined

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

  const variants = graph
    .getChildren(componentSetId)
    .filter((node) => node.type === 'COMPONENT')
    .map((variant) => ({ id: variant.id, values: parseVariantValues(variant.name) }))
  const defined = new Set(
    existingDefinitions
      .filter((definition) => definition.type === 'VARIANT')
      .map((definition) => definition.name)
  )
  // Each property's values in the order the variants first use them.
  const options = groupBy(
    variants.flatMap(({ values }) => Object.entries(values)),
    ([name]) => name
  )
  for (const name of Object.keys(options)) {
    const other = existingDefinitions.find(
      (definition) => definition.name === name && definition.type !== 'VARIANT'
    )
    if (other)
      throw new Error(
        `Variant property ${name} of ${componentSet.name} has the name of its ${other.type} property`
      )
  }
  const definitions: ComponentPropertyDefinition[] = Object.entries(options)
    .filter(([name]) => !defined.has(name))
    .map(([name, entries]) => {
      const variantOptions = uniq(entries.map(([, value]) => value))
      return {
        id: createComponentPropertyId(),
        name,
        type: 'VARIANT',
        defaultValue: variantOptions[0] ?? '',
        variantOptions
      }
    })

  for (const { id, values } of variants) graph.updateNode(id, { componentPropertyValues: values })
  graph.updateNode(componentSetId, {
    componentPropertyDefinitions: [...existingDefinitions, ...definitions]
  })
}
