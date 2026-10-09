import type { StateElement } from '#dom-css/behaviours/states/types'
import type { DesignStyleDeclaration } from '#dom-css/types'
import { isEmptyObject } from 'es-toolkit/predicate'

import {
  findLayerByPath,
  instanceMainComponent,
  isIconModified,
  readIcon,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import type { ComponentModel } from './model'

/** A prop a reference sets on the component it uses: a variant or text value, or `disabled`. */
export interface ReferenceProp {
  name: string
  value: string | true
}

/**
 * Another generated component used where the design places an instance of it, with the values
 * the instance shows. Its own layers are the component's, so they are not drawn here.
 */
export interface ComponentReference {
  type: 'reference'
  /** The component's identifier and file name. */
  component: string
  /** The class the parent's state styles place it by. */
  className: string
  props: ReferenceProp[]
  /** The two-way value the instance is drawn with, when it is on. */
  model: string | null
}

/** An icon from a set, drawn by the framework's Iconify component. */
export interface IconReference {
  type: 'icon'
  /** `prefix:name`. */
  icon: string
  className: string
}

/**
 * How a parent places a layer, as opposed to how the layer looks. A component used in place of
 * a layer keeps its own look and state styles; the parent only places it.
 */
const PLACEMENT =
  /^(position|inset|left|top|right|bottom|(min-|max-)?(width|height)|margin(-.+)?|flex(-.+)?|align-self|justify-self|order|grid-(area|column|row)(-.+)?|transform(-origin)?|rotate|translate|scale|z-index)$/

/** Whether a declaration places a layer rather than drawing it. */
export const isPlacement = (property: string) => PLACEMENT.test(property)

export function placementOnly(element: StateElement): void {
  const placement = (style: DesignStyleDeclaration): DesignStyleDeclaration =>
    Object.fromEntries(Object.entries(style).filter(([property]) => isPlacement(property)))
  element.base = placement(element.base)
  element.rules = element.rules
    .map((rule) => ({ ...rule, style: placement(rule.style) }))
    .filter((rule) => !isEmptyObject(rule.style))
}

/** Generated components by the id of the set they come from, which instances refer to. */
export type ComponentReferences = ReadonlyMap<string, ComponentModel>

/** The set a component belongs to, or the component itself when it stands alone. */
function ownerId(graph: SceneGraph, component: SceneNode): string {
  const parent = component.parentId ? graph.getNode(component.parentId) : undefined
  return parent?.type === 'COMPONENT_SET' ? parent.id : component.id
}

/**
 * What `instance` sets on `component`: the values it is drawn with that differ from defaults,
 * and whether it is drawn on: its model, or for a group's item the value that marks it chosen.
 */
export function referenceValues(
  graph: SceneGraph,
  instance: SceneNode,
  component: ComponentModel
): Pick<ComponentReference, 'props' | 'model'> {
  const values = instanceMainComponent(graph, instance)?.componentPropertyValues ?? {}
  const props: ReferenceProp[] = []
  let model: string | null = null
  for (const [property, arg] of component.args.booleans) {
    if (values[property] !== arg.on) continue
    const on = arg.name === component.model || (component.valueProp && arg.name !== 'disabled')
    if (on) model = arg.name
    else props.push({ name: arg.name, value: true })
  }
  const states = component.args.states
  if (states?.disabled && values[states.property] === states.disabled)
    props.push({ name: 'disabled', value: true })
  for (const prop of component.props) {
    const value = values[prop.property]
    if (Object.hasOwn(values, prop.property) && value !== prop.default)
      props.push({ name: prop.name, value })
  }
  for (const text of component.texts) {
    const value = instance.componentPropertyAssignments[text.id]
    if (typeof value === 'string' && value !== text.default) props.push({ name: text.name, value })
  }
  return { props, model }
}

/** A used layer, before the parent's class name for it is known. */
export type UsedLayer = Omit<ComponentReference, 'className'> | Omit<IconReference, 'className'>

/**
 * What the layer at `element` uses in place of drawing itself, if anything, read from the first
 * variant that draws it: the rest state, or the one that shows it, such as open content.
 */
function usedLayer(
  graph: SceneGraph,
  variantIds: readonly string[],
  element: StateElement,
  references: ComponentReferences
): UsedLayer | null {
  const path = element.key.split('\0')[0] ?? ''
  const node = variantIds
    .map((id) => findLayerByPath(graph, id, path))
    .find((found) => found !== undefined)
  if (!node) return null
  const main = node.type === 'INSTANCE' ? instanceMainComponent(graph, node) : undefined
  const component = main ? references.get(ownerId(graph, main)) : undefined
  if (component)
    return {
      type: 'reference',
      component: component.name,
      ...referenceValues(graph, node, component)
    }
  const icon = readIcon(node)
  return icon && !isIconModified(graph, node) ? { type: 'icon', icon: icon.name } : null
}

/**
 * The layers of a set's merged markup that are used rather than drawn: instances of other
 * generated components, and icons from a set, read from the variants in order, the rest state
 * first. Their own layers are dropped from the markup and the styles, which belong to the
 * component or the icon.
 */
export function referencedLayers(
  graph: SceneGraph,
  root: StateElement,
  variantIds: readonly string[],
  references: ComponentReferences,
  /** Layers already used otherwise, such as a group's items. */
  taken: ReadonlyMap<StateElement, unknown> = new Map()
): Map<StateElement, UsedLayer> {
  const used = new Map<StateElement, UsedLayer>()
  const visit = (element: StateElement) => {
    for (const child of element.children) {
      if (child.type !== 'element' || taken.has(child)) continue
      const layer = usedLayer(graph, variantIds, child, references)
      if (!layer) {
        visit(child)
        continue
      }
      used.set(child, layer)
      child.children = []
      if (layer.type === 'reference') placementOnly(child)
    }
  }
  visit(root)
  return used
}
