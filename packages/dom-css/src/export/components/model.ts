import { behaviourArgs } from '#dom-css/behaviours/args'
import { BUTTON_RESET } from '#dom-css/behaviours/reset'
import { allElements } from '#dom-css/behaviours/states/layers'
import { stateStyles } from '#dom-css/behaviours/states/model'
import { layerClassNames, propAttribute } from '#dom-css/behaviours/states/names'
import type { StateElement, StateStyles } from '#dom-css/behaviours/states/types'
import { camelCase } from 'es-toolkit/string'

import {
  behaviourContract,
  behaviourProperties,
  layerPath,
  readBehaviour,
  slotPropertyId,
  type Behaviour,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import { identifierName } from '../storybook/names'

/** Kinds generated as components so far; the rest keep static stories. */
export const GENERATED_KINDS = ['button', 'switch', 'checkbox', 'toggle', 'collapsible'] as const
export type GeneratedKind = (typeof GENERATED_KINDS)[number]

/** A variant property the component takes as a prop and sets on its root as `data-*`. */
export interface VariantProp {
  /** The prop's identifier. */
  name: string
  /** The variant property it draws, which state styles name the condition after. */
  property: string
  options: string[]
  default: string
}

/**
 * What the control's root binds, which each framework writes in its own idiom: the two-way
 * value (`v-model`, or Radix's `checked` and `onCheckedChange`), `disabled`, and a variant
 * property the component sets as a `data-*` attribute from its prop.
 */
export type ComponentBinding =
  | { type: 'model'; name: string }
  | { type: 'disabled' }
  | { type: 'prop'; prop: VariantProp; attribute: string }

/** A layer of the generated markup, before a framework picks its element or component. */
export interface ComponentElement {
  type: 'element'
  /** The behaviour part the layer draws, `root` for the control itself, or null. */
  part: string | null
  /** The element the design projects to, used when no library component draws the part. */
  tag: string
  /** The readable class the state styles select it by. */
  className: string
  /** Attributes the design sets, such as an image's `src` or its own `class`. */
  attrs: Record<string, string>
  /** On the root only. */
  bindings: ComponentBinding[]
  children: ComponentNode[]
}

export type ComponentNode = ComponentElement | { type: 'text'; value: string }

/** One component generated from a component set with a behaviour. */
export interface ComponentModel {
  /** The component's identifier and file name. */
  name: string
  kind: GeneratedKind
  styles: StateStyles
  /** The markup every framework writes, with each layer's part and the root's bindings. */
  tree: ComponentElement
  /** The boolean the component binds two ways: `checked`, `pressed`, or `open`. */
  model: string | null
  /** Whether the set draws a disabled state, so the component takes `disabled`. */
  disabled: boolean
  props: VariantProp[]
}

function componentTree(
  node: StateElement,
  parts: Map<StateElement, string>,
  classes: Map<StateElement, string>,
  bindings: ComponentBinding[]
): ComponentElement {
  const part = parts.get(node) ?? null
  return {
    type: 'element',
    part,
    tag: node.tagName,
    className: classes.get(node) ?? '',
    attrs: node.attrs,
    bindings: part === 'root' ? bindings : [],
    children: node.children.map((child) =>
      child.type === 'text'
        ? { type: 'text', value: child.text }
        : componentTree(child, parts, classes, [])
    )
  }
}

/** A generated component's files, and what its stories need to know about it. */
export interface GeneratedComponent {
  files: { path: string; content: string }[]
  /** How stories import it: its path next to them, and whether it's a named export. */
  entry: { path: string; named: boolean }
  /** The prop a story sets the value with, if the component has one. */
  valueArg: string | null
}

export type ComponentGenerator = (component: ComponentModel) => Promise<GeneratedComponent>

/** Parts each kind renders as a native button, which the reset clears for the design. */
const BUTTON_PARTS: Record<GeneratedKind, readonly string[]> = {
  button: ['root'],
  switch: ['root'],
  checkbox: ['root'],
  toggle: ['root'],
  collapsible: ['trigger']
}

const isGenerated = (kind: Behaviour['kind']): kind is GeneratedKind =>
  (GENERATED_KINDS as readonly string[]).includes(kind)

/** Layer paths of the slot frames that draw each part, the same in every variant. */
function partPaths(graph: SceneGraph, set: SceneNode, behaviour: Behaviour): Map<string, string> {
  const partOfSlot = new Map(Object.entries(behaviour.parts).map(([part, slot]) => [slot, part]))
  const paths = new Map<string, string>()
  const visit = (variant: SceneNode, node: SceneNode) => {
    const part = partOfSlot.get(slotPropertyId(node) ?? '')
    if (part) paths.set(layerPath(graph, variant.id, node.id), part)
    for (const child of graph.getChildren(node.id)) visit(variant, child)
  }
  for (const variant of graph.getChildren(set.id))
    for (const child of graph.getChildren(variant.id)) visit(variant, child)
  return paths
}

/**
 * The component a set with a behaviour generates, or `null` when its kind is not generated
 * yet or its variants have no rest state to start from.
 */
export function componentModel(graph: SceneGraph, set: SceneNode): ComponentModel | null {
  const behaviour = readBehaviour(set)
  if (!behaviour || !isGenerated(behaviour.kind)) return null
  const styles = stateStyles(graph, set)
  const args = behaviourArgs(graph, set)
  if (!styles || !args) return null

  const paths = partPaths(graph, set, behaviour)
  const parts = new Map<StateElement, string>([[styles.root, 'root']])
  for (const element of allElements(styles.root)) {
    const part = paths.get(element.key)
    if (part && behaviourContract(behaviour.kind).parts.some((item) => item.id === part))
      parts.set(element, part)
  }
  for (const [element, part] of parts)
    if (BUTTON_PARTS[behaviour.kind].includes(part))
      element.base = { ...BUTTON_RESET, ...element.base }

  const booleans = [...args.booleans.values()]
  const model = booleans.find((arg) => arg.name !== 'disabled')?.name ?? null
  const bound = new Set([...args.booleans.keys(), args.states?.property])
  const props = behaviourProperties(graph, set)
    .filter((definition) => definition.type === 'VARIANT' && !bound.has(definition.name))
    .map((definition) => ({
      name: camelCase(identifierName(definition.name, 'Prop')),
      property: definition.name,
      options: definition.variantOptions ?? [],
      default: definition.defaultValue
    }))
  const disabled =
    booleans.some((arg) => arg.name === 'disabled') || args.states?.disabled !== undefined
  const bindings: ComponentBinding[] = [
    ...(model ? [{ type: 'model' as const, name: model }] : []),
    ...(disabled ? [{ type: 'disabled' as const }] : []),
    ...props.map((prop) => ({
      type: 'prop' as const,
      prop,
      attribute: propAttribute(prop.property)
    }))
  ]
  return {
    name: identifierName(set.name, 'Component'),
    kind: behaviour.kind,
    styles,
    tree: componentTree(styles.root, parts, layerClassNames(styles), bindings),
    model,
    disabled,
    props
  }
}
