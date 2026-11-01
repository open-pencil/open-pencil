import { DESIGN_JSX_SUPPORTED_PROPERTIES } from '#design-jsx/definitions'
import { countBy, isEmptyObject, isEqual } from 'es-toolkit'

import { es } from '@open-pencil/emit'
import type {
  ComponentPropertyDefinition,
  ComponentPropertyReference,
  SceneGraph,
  SceneNode
} from '@open-pencil/scene-graph'
import { componentPropertyDefinitions } from '@open-pencil/scene-graph/components'
import { INSTANCE_OVERRIDE_FIELDS, instanceMainComponent } from '@open-pencil/scene-graph/instances'

import { collectProps, positionProps } from '../props'
import { plainValue, type JSXProp, type JSXValue } from '../value'
import type { VariableExport } from '../variables'
import type { ComponentReference } from './references'

/**
 * The fields `overrides` writes for a layer inside an instance, as it sets them. Bindings and
 * pinned modes name variables by ID, which another graph does not have.
 */
const WRITTEN_OVERRIDE_FIELDS = new Set<string>(
  INSTANCE_OVERRIDE_FIELDS.filter(
    (field) => field !== 'boundVariables' && field !== 'variableModes'
  )
)

/** The fields an assignment to the property a layer binds changes, which the assignment writes. */
const ASSIGNED_FIELDS: Record<ComponentPropertyReference['field'], readonly string[]> = {
  TEXT: ['text', 'styleRuns', 'textParagraphs'],
  VISIBLE: ['visible'],
  INSTANCE_SWAP: ['componentId', 'sourceComponentId', 'name'],
  SLOT_CONTENT: []
}

/** A name an instance can take as a prop: a JSX name design JSX gives no meaning of its own. */
function isPropName(name: string): boolean {
  return es.isIdentifierName(name) && !DESIGN_JSX_SUPPORTED_PROPERTIES.has(name)
}

function descendants(graph: SceneGraph, node: SceneNode): SceneNode[] {
  return graph.getChildren(node.id).flatMap((child) => [child, ...descendants(graph, child)])
}

/**
 * What the instance's layers override, as `overrides` sets it: `{ 'Label:fills': [...] }`,
 * keyed by the name each layer has in a new instance. An override equal to the component's value
 * is written too, so the layer keeps it when the component changes. A renamed layer is renamed
 * last, so the keys before it still find it. Null when an override cannot be written that way: one on a
 * nested instance, a binding, or a layer whose name another layer of the instance shares.
 */
function layerOverrides(graph: SceneGraph, instance: SceneNode): Record<string, JSXValue> | null {
  const layers = descendants(graph, instance)
  const sources = new Map(layers.map((layer) => [layer.id, graph.getNode(layer.componentId ?? '')]))
  const names = countBy(layers, (layer) => sources.get(layer.id)?.name ?? '')
  const fields: Array<[string, JSXValue]> = []
  const renames: Array<[string, JSXValue]> = []
  for (const [layerId, overridden] of instance.instanceOverrides.descendants) {
    const layer = graph.getNode(layerId)
    const source = sources.get(layerId)
    if (!layer || !sources.has(layerId)) continue
    const assigned = new Set(
      layer.componentPropertyReferences.flatMap((reference) => ASSIGNED_FIELDS[reference.field])
    )
    for (const field of overridden.keys()) {
      if (assigned.has(field)) continue
      if (layer.type === 'INSTANCE' || !source || !WRITTEN_OVERRIDE_FIELDS.has(field)) return null
      if (names[source.name] !== 1) return null
      const value: unknown = layer[field as keyof SceneNode]
      const entry: [string, JSXValue] = [`${source.name}:${field}`, plainValue(value)]
      if (field === 'name') renames.push(entry)
      else fields.push(entry)
    }
  }
  return Object.fromEntries([...fields, ...renames])
}

function assignedValue(
  graph: SceneGraph,
  definition: ComponentPropertyDefinition,
  value: string,
  reference: ComponentReference
): JSXValue {
  if (definition.type === 'BOOLEAN') return value === 'true'
  if (definition.type !== 'INSTANCE_SWAP') return value
  const component = graph.getNode(value)
  return component ? reference.of(component) : value
}

/**
 * The values an instance gives its component's properties, by name, as `<Instance>` takes them:
 * as props where the name can be one, else in `properties`. Defaults are left out. Null when one
 * is a slot's content, which JSX cannot write, or names a property whose name another shares:
 * a render gives properties new IDs, so only the name finds one.
 */
function assignmentProps(
  graph: SceneGraph,
  instance: SceneNode,
  reference: ComponentReference
): JSXProp[] | null {
  const definitions = componentPropertyDefinitions(graph, instance)
  const names = countBy(definitions, (definition) => definition.name)
  const props: JSXProp[] = []
  const properties: Record<string, JSXValue> = {}
  for (const [id, value] of Object.entries(instance.componentPropertyAssignments)) {
    const definition = definitions.find((item) => item.id === id)
    if (!definition || definition.type === 'VARIANT' || value === definition.defaultValue) continue
    if (definition.type === 'SLOT' || names[definition.name] !== 1) return null
    const written = assignedValue(graph, definition, value, reference)
    if (isPropName(definition.name)) props.push([definition.name, written])
    else properties[definition.name] = written
  }
  return Object.keys(properties).length > 0 ? [...props, ['properties', properties]] : props
}

/**
 * The component an instance names: its set and variant values, `of="Button" State="On"`, or
 * the variant itself where a value's name cannot be a prop.
 */
export function componentProps(
  graph: SceneGraph,
  component: SceneNode,
  reference: ComponentReference
): JSXProp[] {
  const set = component.parentId ? graph.getNode(component.parentId) : undefined
  const values = Object.entries(component.componentPropertyValues)
  if (set?.type !== 'COMPONENT_SET' || !values.every(([name]) => isPropName(name)))
    return [['of', reference.of(component)]]
  return [['of', reference.of(set)], ...values]
}

/**
 * A group's item as its `Item` props: the component it is of, whether it is hidden, its opacity,
 * the values it gives the component's properties, and what its layers override. The group places
 * the item, so its other layer props are not written. Null when some of that cannot be written,
 * as for `instanceProps`.
 */
export function itemProps(
  graph: SceneGraph,
  item: SceneNode,
  component: SceneNode,
  reference: ComponentReference
): JSXProp[] | null {
  const assignments = assignmentProps(graph, item, reference)
  const overrides = layerOverrides(graph, item)
  if (!assignments || !overrides) return null
  return [
    ...componentProps(graph, component, reference),
    ...(item.visible ? [] : [['visible', false] as JSXProp]),
    ...(item.opacity < 1 ? [['opacity', item.opacity] as JSXProp] : []),
    ...assignments,
    ...(isEmptyObject(overrides) ? [] : [['overrides', overrides] as JSXProp])
  ]
}

/**
 * An instance as `<Instance>` props: the component it is of, its own layer's props where they
 * differ from the component's, the values it gives the component's properties, and what its
 * layers override. Its layers are the component's to draw, so they are not written. Null when
 * some of that cannot be written, so the instance is written as the frame it draws.
 */
export function instanceProps(
  node: SceneNode,
  graph: SceneGraph,
  variables: VariableExport,
  reference: ComponentReference
): JSXProp[] | null {
  const component = instanceMainComponent(graph, node)
  if (!component) return null
  const assignments = assignmentProps(graph, node, reference)
  const overrides = layerOverrides(graph, node)
  if (!assignments || !overrides) return null

  const own = collectProps(node, graph, variables, reference)
  const inherited = collectProps(component, graph, variables, reference)
  const placement = new Set(
    [...positionProps(node, graph), ...positionProps(component, graph)].map(([name]) => name)
  )
  placement.add('name')
  // A prop the component sets and the instance leaves at its default cannot be written.
  if (inherited.some(([name]) => !placement.has(name) && !own.some(([key]) => key === name)))
    return null
  const differs = own.filter(
    ([name, value]) =>
      placement.has(name) ||
      !inherited.some(([key, inheritedValue]) => key === name && isEqual(value, inheritedValue))
  )
  const bound = differs.find(([name]) => name === 'of')
  return [
    ...differs.filter(([name]) => name === 'name'),
    ...(bound ? [bound] : componentProps(graph, component, reference)),
    ...differs.filter(([name]) => name !== 'name' && name !== 'of'),
    ...assignments,
    ...(Object.keys(overrides).length > 0 ? [['overrides', overrides] as JSXProp] : [])
  ]
}
