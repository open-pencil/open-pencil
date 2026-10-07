import {
  behaviourFromSpec,
  createComponentPropertyId,
  createSlotProperty,
  withBehaviour,
  type BehaviourKind,
  type BehaviourSpec,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import { node, type TreeNode } from '../tree'

/** What a Reka UI element is to the component it builds. */
export type RekaRole =
  | { role: 'root'; kind: BehaviourKind }
  /** A Reka subcomponent drawn by a slot of the component, such as a switch's thumb. */
  | { role: 'part'; part: string }
  /** One of a slot's repeated parts, such as a tab trigger in the tab list. */
  | { role: 'repeat'; container: string }
  /** The text layer a text value shows, which becomes the field's text property. */
  | { role: 'input'; valueId: string }
  /** A Reka wrapper with no state of its own, drawn as a plain frame. */
  | { role: 'frame' }

const root = (kind: BehaviourKind): RekaRole => ({ role: 'root', kind })
const part = (id: string): RekaRole => ({ role: 'part', part: id })
const repeat = (container: string): RekaRole => ({ role: 'repeat', container })
const input = (valueId: string): RekaRole => ({ role: 'input', valueId })

/**
 * Design JSX's Reka UI elements, by namespace and part, after Reka's own anatomy: `Switch.Root`
 * is a main component that behaves as a switch and `Switch.Thumb` its thumb slot. A group's
 * `Item` is the component of its items when written on its own, and an item when it names one
 * with `of`, as an `Instance` does.
 */
const REKA_PARTS = {
  Button: { Root: root('button') },
  Toggle: { Root: root('toggle') },
  Switch: { Root: root('switch'), Thumb: part('thumb') },
  Checkbox: { Root: root('checkbox'), Indicator: part('indicator') },
  RadioGroup: { Root: root('radioGroup'), Item: root('radio'), Indicator: part('indicator') },
  ToggleGroup: { Root: root('toggleGroup'), Item: root('toggle') },
  Slider: {
    Root: root('slider'),
    Track: part('track'),
    Range: part('range'),
    Thumb: part('thumb')
  },
  Progress: { Root: root('progress'), Indicator: part('indicator') },
  Tabs: {
    Root: root('tabs'),
    List: part('list'),
    Trigger: repeat('list'),
    Content: repeat('panels')
  },
  Collapsible: { Root: root('collapsible'), Trigger: part('trigger'), Content: part('content') },
  Accordion: {
    Root: root('accordion'),
    Item: root('collapsible'),
    Header: { role: 'frame' },
    Trigger: part('trigger'),
    Content: part('content')
  },
  NumberField: {
    Root: root('numberField'),
    Input: input('text'),
    Increment: part('increment'),
    Decrement: part('decrement')
  },
  TextField: { Root: root('textField'), Input: input('value') },
  Textarea: { Root: root('textarea'), Input: input('value') }
} as const satisfies Readonly<Record<string, Readonly<Record<string, RekaRole>>>>

/** Each Reka namespace and its parts, as typed elements are built from them. */
export type RekaNamespaces = typeof REKA_PARTS

/** The same elements, looked up by any element name, as parsing and export do. */
export const REKA_ELEMENTS: Readonly<Record<string, Readonly<Record<string, RekaRole>>>> =
  REKA_PARTS

/** The container a repeated part goes in when written directly under its root. */
const CONTAINER_NAMES: Record<string, string> = { list: 'List', panels: 'Panels', items: 'Items' }

/** The role of a Reka element type such as `Switch.Thumb`, or undefined for other elements. */
export function rekaRole(type: string): RekaRole | undefined {
  const dot = type.indexOf('.')
  if (dot === -1) return undefined
  const namespace = REKA_ELEMENTS[type.slice(0, dot)] as Record<string, RekaRole> | undefined
  return namespace?.[type.slice(dot + 1)]
}

/** The element type for a part container that JSX leaves implicit. */
const containerType = (container: string) => `reka-container:${container}`

export function containerPart(type: string): string | undefined {
  return type.startsWith('reka-container:') ? type.slice('reka-container:'.length) : undefined
}

/** Whether an element names an existing component, as an item of a group does. */
export function namesComponent(props: Record<string, unknown>): boolean {
  return props.of !== undefined || props.component !== undefined || props.componentId !== undefined
}

const GROUPS = new Set<BehaviourKind>(['radioGroup', 'toggleGroup', 'accordion'])

/** The container slot a child written directly under a root belongs in, if any. */
function containerOf(child: TreeNode, kind: BehaviourKind): string | undefined {
  const role = rekaRole(child.type)
  if (role?.role === 'repeat') return role.container
  if (GROUPS.has(kind) && role?.role === 'root' && namesComponent(child.props)) return 'items'
  return undefined
}

/**
 * A root's children with repeated parts and group items that are written directly under it
 * wrapped in their container slot, as the behaviour binds them: tab panels in Panels, a group's
 * items in Items. Containers the JSX writes itself are kept.
 */
export function wrapRepeatedParts(tree: TreeNode, kind: BehaviourKind): TreeNode['children'] {
  const result: TreeNode['children'] = []
  let open: TreeNode | null = null
  for (const child of tree.children) {
    const container = typeof child === 'string' ? undefined : containerOf(child, kind)
    if (!container || typeof child === 'string') {
      open = null
      result.push(child)
      continue
    }
    if (open?.type !== containerType(container)) {
      open = node(containerType(container), {
        name: CONTAINER_NAMES[container] ?? container,
        flex: kind === 'toggleGroup' ? 'row' : 'col',
        gap: kind === 'toggleGroup' ? 4 : 8
      })
      result.push(open)
    }
    open.children.push(child)
  }
  return result
}

/** What a root collects from its parts while they render. */
export interface RekaScope {
  kind: BehaviourKind
  ownerId: string
  /** Slot property ids by part, shared by every variant of a set. */
  slots: Map<string, string>
  /** Text property ids by value, defined once on the root. */
  texts: Map<string, string>
}

export function createScope(kind: BehaviourKind, ownerId: string): RekaScope {
  return { kind, ownerId, slots: new Map(), texts: new Map() }
}

/** Make a rendered part frame its part's slot, with the id the part has in this component. */
export function bindPart(graph: SceneGraph, scope: RekaScope, frame: SceneNode, partId: string) {
  const id = scope.slots.get(partId) ?? createComponentPropertyId()
  if (!createSlotProperty(graph, frame.id, id))
    throw new Error(`<${partId}> must be inside a main component`)
  scope.slots.set(partId, id)
}

/** Make a rendered text layer show the value's text property, defined on the root. */
export function bindInput(
  graph: SceneGraph,
  scope: RekaScope,
  text: SceneNode,
  valueId: string,
  propertyName: string
) {
  let id = scope.texts.get(valueId)
  if (!id) {
    id = createComponentPropertyId()
    scope.texts.set(valueId, id)
    const owner = graph.getNode(scope.ownerId)
    graph.updateNode(scope.ownerId, {
      componentPropertyDefinitions: [
        ...(owner?.componentPropertyDefinitions ?? []),
        { id, name: propertyName, type: 'TEXT', defaultValue: text.text }
      ]
    })
  }
  graph.updateNode(text.id, {
    componentPropertyReferences: [
      ...text.componentPropertyReferences,
      { propertyId: id, field: 'TEXT' }
    ]
  })
}

/** Root props that describe the behaviour rather than the drawing. */
export const BEHAVIOUR_PROPS = [
  'modelValue',
  'open',
  'disabled',
  'filled',
  'states',
  'min',
  'max',
  'step',
  'defaultValue'
] as const

/** A value bound to a component property by name; a variant property may name its on and off. */
export type BindingProp = string | { property: string; on?: string; off?: string }

function isBinding(value: unknown): value is BindingProp {
  return (
    typeof value === 'string' ||
    (typeof value === 'object' &&
      value !== null &&
      'property' in value &&
      typeof value.property === 'string')
  )
}

/** The spec a root's props give: values by property name, a range, and states. */
function rootSpec(kind: BehaviourKind, props: Record<string, unknown>): BehaviourSpec {
  const values: NonNullable<BehaviourSpec['values']> = {}
  const main = kind === 'collapsible' ? props.open : props.modelValue
  if (isBinding(main)) values[kind === 'collapsible' ? 'open' : 'value'] = main
  if (isBinding(props.disabled)) values.disabled = props.disabled
  if (isBinding(props.filled)) values.filled = props.filled
  const range = Object.fromEntries(
    (['min', 'max', 'step'] as const).flatMap((key) =>
      typeof props[key] === 'number' ? [[key, props[key]]] : []
    )
  )
  if (typeof props.defaultValue === 'number') range.default = props.defaultValue
  const spec: BehaviourSpec = { kind }
  if (Object.keys(values).length) spec.values = values
  if (Object.keys(range).length) spec.numbers = { value: range }
  if (typeof props.states === 'string') spec.states = props.states
  return spec
}

/** Store the behaviour a rendered root describes, with the slots and texts its parts made. */
export function finishRoot(
  graph: SceneGraph,
  scope: RekaScope,
  props: Record<string, unknown>
): void {
  const owner = graph.getNode(scope.ownerId)
  if (!owner) return
  const behaviour = behaviourFromSpec(graph, owner, rootSpec(scope.kind, props))
  behaviour.parts = { ...behaviour.parts, ...Object.fromEntries(scope.slots) }
  behaviour.texts = {
    ...behaviour.texts,
    ...Object.fromEntries([...scope.texts].map(([valueId, id]) => [valueId, { propertyId: id }]))
  }
  graph.updateNode(owner.id, { pluginData: withBehaviour(owner, behaviour) })
}
