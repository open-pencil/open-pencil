import {
  behaviourToSpec,
  instanceMainComponent,
  readBehaviour,
  slotPropertyId,
  textBinding,
  type BehaviourKind,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import { REKA_ELEMENTS, rekaRole } from '../behaviours'
import type { JSXProp, JSXValue } from './value'

/** The Reka namespace and element a kind's component is written as. */
const ROOTS: Record<BehaviourKind, [namespace: string, element: string]> = {
  button: ['Button', 'Root'],
  toggle: ['Toggle', 'Root'],
  switch: ['Switch', 'Root'],
  checkbox: ['Checkbox', 'Root'],
  radio: ['RadioGroup', 'Item'],
  radioGroup: ['RadioGroup', 'Root'],
  toggleGroup: ['ToggleGroup', 'Root'],
  slider: ['Slider', 'Root'],
  progress: ['Progress', 'Root'],
  tabs: ['Tabs', 'Root'],
  collapsible: ['Collapsible', 'Root'],
  accordion: ['Accordion', 'Root'],
  numberField: ['NumberField', 'Root'],
  textField: ['TextField', 'Root'],
  textarea: ['Textarea', 'Root']
}

/** How the layers of a component with a behaviour are written as Reka elements. */
export interface RekaExport {
  /** Element names by layer id: the root, its parts, its input, and repeated parts. */
  tags: Map<string, string>
  /** Props a layer adds: the root's behaviour, an item's component. */
  props: Map<string, JSXProp[]>
  /** Containers JSX leaves implicit, written as their children alone. */
  flatten: Set<string>
}

/** The element a part is written as in a namespace, such as `Thumb` for a switch's thumb. */
function elementFor(namespace: string, match: (role: ReturnType<typeof rekaRole>) => boolean) {
  const parts = REKA_ELEMENTS[namespace] ?? {}
  const found = Object.keys(parts).find((element) => match(rekaRole(`${namespace}.${element}`)))
  return found ? `${namespace}.${found}` : undefined
}

function rootProps(graph: SceneGraph, owner: SceneNode): JSXProp[] {
  const behaviour = readBehaviour(owner)
  if (!behaviour) return []
  const spec = behaviourToSpec(graph, owner, behaviour)
  const props: JSXProp[] = []
  const valueProp = (value: NonNullable<typeof spec.values>[string]): JSXValue =>
    typeof value === 'string' ? value : { property: value.property, on: value.on, off: value.off }
  for (const [valueId, value] of Object.entries(spec.values ?? {})) {
    if (Object.hasOwn(behaviour.texts, valueId)) continue
    const name = valueId === 'value' ? 'modelValue' : valueId
    props.push([name, valueProp(value)])
  }
  const range = spec.numbers?.value
  if (range) {
    for (const key of ['min', 'max', 'step'] as const) {
      const value = range[key]
      if (value !== undefined) props.push([key, value])
    }
    if (range.default !== undefined) props.push(['defaultValue', range.default])
  }
  if (spec.states)
    props.push(['states', typeof spec.states === 'string' ? spec.states : spec.states.property])
  return props
}

/** A part's slot frame as its element, and its children as the repeated parts or items. */
function exportPart(
  graph: SceneGraph,
  namespace: string,
  layer: SceneNode,
  partId: string,
  result: RekaExport
): void {
  const tag = elementFor(namespace, (role) => role?.role === 'part' && role.part === partId)
  const repeated = elementFor(
    namespace,
    (role) => role?.role === 'repeat' && role.container === partId
  )
  if (tag) result.tags.set(layer.id, tag)
  else result.flatten.add(layer.id)
  for (const child of graph.getChildren(layer.id)) {
    if (repeated) result.tags.set(child.id, repeated)
    const item = child.type === 'INSTANCE' ? instanceMainComponent(graph, child) : undefined
    if (partId !== 'items' || !item) continue
    // A group's items are written as the group's Item, naming their component.
    const set = item.parentId ? graph.getNode(item.parentId) : undefined
    result.tags.set(child.id, `${namespace}.Item`)
    result.props.set(child.id, [['of', (set?.type === 'COMPONENT_SET' ? set : item).id]])
  }
}

/** Every layer below a node, depth first. */
function descendants(graph: SceneGraph, node: SceneNode): SceneNode[] {
  return graph.getChildren(node.id).flatMap((child) => [child, ...descendants(graph, child)])
}

/**
 * How a main component or component set with a behaviour is written: `Switch.Root` and its
 * `Switch.Thumb`, `TextField.Input`, tab triggers and panels, and a group's items as
 * `RadioGroup.Item of="…"`. Null for other layers.
 */
export function rekaExport(graph: SceneGraph, owner: SceneNode): RekaExport | null {
  const behaviour = readBehaviour(owner)
  if (!behaviour || (owner.type !== 'COMPONENT' && owner.type !== 'COMPONENT_SET')) return null
  const [namespace, element] = ROOTS[behaviour.kind]
  const result: RekaExport = {
    tags: new Map([[owner.id, `${namespace}.${element}`]]),
    props: new Map([[owner.id, rootProps(graph, owner)]]),
    flatten: new Set()
  }
  const textIds = new Map(
    Object.keys(behaviour.texts).map((valueId) => [textBinding(behaviour, valueId), valueId])
  )
  for (const layer of descendants(graph, owner)) {
    if (layer.type === 'INSTANCE') continue
    const partId = Object.entries(behaviour.parts).find(
      ([, id]) => id === slotPropertyId(layer)
    )?.[0]
    if (partId) {
      exportPart(graph, namespace, layer, partId, result)
      continue
    }
    const reference = layer.componentPropertyReferences.find((item) => item.field === 'TEXT')
    const valueId = reference && textIds.get(reference.propertyId)
    if (layer.type === 'TEXT' && valueId) {
      const tag = elementFor(
        namespace,
        (role) => role?.role === 'input' && role.valueId === valueId
      )
      if (tag) result.tags.set(layer.id, tag)
    }
  }
  return result
}
