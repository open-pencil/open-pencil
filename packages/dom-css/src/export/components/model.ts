import { behaviourArgs, type BehaviourArgs } from '#dom-css/behaviours/args'
import { BUTTON_RESET } from '#dom-css/behaviours/reset'
import { allElements } from '#dom-css/behaviours/states/layers'
import { ownerVariants, stateStyles } from '#dom-css/behaviours/states/model'
import { layerClassNames, propAttribute } from '#dom-css/behaviours/states/names'
import type { StateElement, StateStyles } from '#dom-css/behaviours/states/types'
import { uniq } from 'es-toolkit/array'
import { camelCase } from 'es-toolkit/string'

import {
  behaviourContract,
  behaviourProperties,
  layerPath,
  readBehaviour,
  slotPropertyId,
  textBinding,
  variantDefaultValue,
  type Behaviour,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import type { SceneGraphToDesignOptions } from '../projection'
import { claimName, identifierName } from '../storybook/names'
import {
  blockRoot,
  freePlacedParts,
  inputLayers,
  inputValue,
  numberInput,
  rangeModel,
  textModel,
  type InputLayers
} from './fields'
import {
  groupItems,
  GROUP_ITEMS,
  isGroup,
  type GroupKind,
  type ItemBuilder,
  type ItemKind
} from './groups'
import {
  booleanProps,
  slotProps,
  textProps,
  type BooleanProp,
  type SlotProp,
  type TextProp
} from './properties'
import {
  referencedLayers,
  type ComponentReference,
  type ComponentReferences,
  type IconReference,
  type UsedLayer
} from './references'
import { activeTriggers, tabParts, type ChoiceModel, type RepeatedPart } from './repeats'

/** Kinds generated as components so far; the rest keep static stories. */
export const GENERATED_KINDS = [
  'button',
  'switch',
  'checkbox',
  'toggle',
  'collapsible',
  'tabs',
  'radioGroup',
  'toggleGroup',
  'accordion',
  'slider',
  'progress',
  'numberField',
  'textField',
  'textarea'
] as const

/** What a generated component is: a control on its own, or a group's item. */
/**
 * What a generated component is: a control on its own, a group's item, or `plain`, a component
 * without a behaviour, which takes its properties as props and has no control of its own.
 */
export type GeneratedKind = (typeof GENERATED_KINDS)[number] | ItemKind | 'plain'

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
  /** A group's item: the value it stands for, which the group chooses among. */
  | { type: 'value' }
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
  /** The boolean prop that shows the layer, which hides it while off. */
  shownBy?: string
  /** The slot prop whose content the layer shows in place of its own. */
  slot?: string
  /** The value a repeated part stands for, such as a tab trigger's tab. */
  value?: string
  children: ComponentNode[]
}

/** A number the component binds two ways, within its range, starting where the design does. */
export interface RangeModel {
  min: number
  max: number
  step: number
  default: number
}

/**
 * Text a field binds two ways: the words it starts with, and the placeholder an empty field
 * shows when the design draws one.
 */
export interface TextModel {
  default: string
  placeholder: string | null
}

export type ComponentNode =
  | ComponentElement
  | { type: 'text'; value: string }
  /** The value of a text prop, drawn where the design binds a text layer to it. */
  | { type: 'textProp'; name: string }
  /** A field's input, drawn where the design binds its text layer to the field's text. */
  | { type: 'input'; className: string }
  | ComponentReference
  | IconReference

/** One component generated from a component set with a behaviour. */
export interface ComponentModel {
  /** The component's identifier and file name. */
  name: string
  kind: GeneratedKind
  styles: StateStyles
  /** The markup every framework writes, with each layer's part and the root's bindings. */
  tree: ComponentElement
  /**
   * The value the component binds two ways: a boolean such as `checked`, `pressed`, or `open`,
   * or `value` when it chooses among `choice`, as tabs do.
   */
  model: string | null
  /** The options a string model takes and the one it starts on. */
  choice: ChoiceModel | null
  /** The range a number model takes, as a slider, progress bar, or number field has. */
  range: RangeModel | null
  /** The text a text field or textarea binds. */
  text: TextModel | null
  /** A group's item takes the `value` it stands for, which the group chooses among. */
  valueProp: boolean
  /** The component of a group's items, generated beside the group's own. */
  item: ComponentModel | null
  /** Whether the set draws a disabled state, so the component takes `disabled`. */
  disabled: boolean
  props: VariantProp[]
  texts: TextProp[]
  booleans: BooleanProp[]
  slots: SlotProp[]
  /** The variant properties that draw its booleans and states, which references set. */
  args: BehaviourArgs
}

interface TreeLabels {
  parts: Map<StateElement, string>
  classes: Map<StateElement, string>
  /** The text prop each bound text layer draws, by layer. */
  texts: Map<StateElement, string>
  /** Layers that use another component or an icon in place of drawing themselves. */
  used: Map<StateElement, UsedLayer>
  /** Layers drawn once per value, such as tab triggers and panels. */
  repeated: Map<StateElement, RepeatedPart>
  /** A field's text layer, drawn as its input, and the ones it replaces. */
  input: InputLayers | null
  /** The boolean prop that shows each bound layer. */
  shownBy: Map<StateElement, string>
  /** The slot prop each slot frame shows. */
  slotOf: Map<StateElement, string>
}

function componentTree(
  node: StateElement,
  labels: TreeLabels,
  bindings: ComponentBinding[]
): ComponentElement {
  const repeated = labels.repeated.get(node)
  const part = repeated?.part ?? labels.parts.get(node) ?? null
  const text = labels.texts.get(node)
  return {
    type: 'element',
    part,
    ...(repeated ? { value: repeated.value } : {}),
    tag: node.tagName,
    className: labels.classes.get(node) ?? '',
    attrs: node.attrs,
    bindings: part === 'root' ? bindings : [],
    shownBy: labels.shownBy.get(node),
    slot: labels.slotOf.get(node),
    // A bound text layer draws its prop in place of the design's words and their runs.
    children: text
      ? [{ type: 'textProp', name: text }]
      : node.children.flatMap((child) =>
          child.type === 'text' ? [{ type: 'text', value: child.text }] : childNode(child, labels)
        )
  }
}

function childNode(element: StateElement, labels: TreeLabels): ComponentNode[] {
  const className = labels.classes.get(element) ?? ''
  if (labels.input?.element === element) return [{ type: 'input', className }]
  if (labels.input?.replaced.includes(element)) return []
  const used = labels.used.get(element)
  if (!used) return [componentTree(element, labels, [])]
  return [{ ...used, className }]
}

/** A generated component's files, and what its stories need to know about it. */
export interface GeneratedComponent {
  files: { path: string; content: string }[]
  /** How stories import it: its path next to them, and whether it's a named export. */
  entry: { path: string; named: boolean }
  /** The prop a story sets the value with, if the component has one. */
  valueArg: string | null
  /** Whether that prop takes a list of the value, as Radix's slider does. */
  valueList?: boolean
}

export type ComponentGenerator = (component: ComponentModel) => Promise<GeneratedComponent>

/** Parts each kind renders as a native button, which the reset clears for the design. */
const BUTTON_PARTS: Record<GeneratedKind, readonly string[]> = {
  button: ['root'],
  switch: ['root'],
  checkbox: ['root'],
  toggle: ['root'],
  collapsible: ['trigger'],
  tabs: ['trigger'],
  radioGroup: [],
  toggleGroup: [],
  accordion: [],
  slider: [],
  progress: [],
  numberField: ['increment', 'decrement'],
  textField: [],
  textarea: [],
  plain: [],
  radioGroupItem: ['root'],
  toggleGroupItem: ['root'],
  accordionItem: ['trigger']
}

const isGenerated = (kind: Behaviour['kind']): kind is (typeof GENERATED_KINDS)[number] =>
  (GENERATED_KINDS as readonly string[]).includes(kind)

/** What an owner generates as: a group's item when it is one, its own kind, or nothing. */
function generatedKind(kind: Behaviour['kind'], itemOf?: GroupKind): GeneratedKind | null {
  if (itemOf) return GROUP_ITEMS[itemOf]
  return isGenerated(kind) ? kind : null
}

/** Layer paths of the slot frames that draw each part, the same in every variant. */
function partPaths(graph: SceneGraph, set: SceneNode, behaviour: Behaviour): Map<string, string> {
  const partOfSlot = new Map(Object.entries(behaviour.parts).map(([part, slot]) => [slot, part]))
  const paths = new Map<string, string>()
  const visit = (variant: SceneNode, node: SceneNode) => {
    const part = partOfSlot.get(slotPropertyId(node) ?? '')
    if (part) paths.set(layerPath(graph, variant.id, node.id), part)
    for (const child of graph.getChildren(node.id)) visit(variant, child)
  }
  for (const variant of ownerVariants(graph, set))
    for (const child of graph.getChildren(variant.id)) visit(variant, child)
  return paths
}

/**
 * The component a set with a behaviour generates, or `null` when its kind is not generated
 * yet or its variants have no rest state to start from.
 */
export interface ComponentModelOptions extends Pick<SceneGraphToDesignOptions, 'vectorElement'> {
  /**
   * The other components generated alongside, which instances of them use rather than
   * drawing their layers.
   */
  references?: ComponentReferences
  /** The component's identifier and file name; the owner's name by default. */
  name?: string
  /** A group's item component's name; the group's name with `Item` by default. */
  itemName?: string
  /** Generate the owner as the item of a group of this kind, which only lives in the group. */
  itemOf?: GroupKind
}

/** Each layer's behaviour part: the root, and the slot frames that draw the others. */
function behaviourParts(
  graph: SceneGraph,
  set: SceneNode,
  behaviour: Behaviour,
  root: StateElement
): Map<StateElement, string> {
  const paths = partPaths(graph, set, behaviour)
  const contract = behaviourContract(behaviour.kind).parts
  const parts = new Map<StateElement, string>([[root, 'root']])
  for (const element of allElements(root)) {
    const part = paths.get(element.key)
    if (part && contract.some((item) => item.id === part)) parts.set(element, part)
  }
  return parts
}

/** Clears the native button look from the parts a kind renders as buttons. */
function resetButtons(
  kind: GeneratedKind,
  parts: ReadonlyMap<StateElement, string>,
  repeated: ReadonlyMap<StateElement, RepeatedPart>
): void {
  const all = [...parts, ...[...repeated].map(([element, item]) => [element, item.part] as const)]
  for (const [element, part] of all)
    if (BUTTON_PARTS[kind].includes(part)) element.base = { ...BUTTON_RESET, ...element.base }
}

/** The variant properties that are not values or states, as props set as `data-*`. */
function variantProps(
  graph: SceneGraph,
  set: SceneNode,
  args: BehaviourArgs,
  taken: Set<string>
): VariantProp[] {
  const bound = new Set([...args.booleans.keys(), args.states?.property, args.filled?.property])
  return behaviourProperties(graph, set)
    .filter((definition) => definition.type === 'VARIANT' && !bound.has(definition.name))
    .map((definition) => ({
      name: claimName(camelCase(identifierName(definition.name, 'Prop')), taken),
      property: definition.name,
      // A document may record no options, which the variants' own values then are.
      options: uniq([
        ...(definition.variantOptions ?? []),
        ...ownerVariants(graph, set).map(
          (variant) => variant.componentPropertyValues[definition.name] ?? ''
        )
      ]).filter((option) => option !== ''),
      default: variantDefaultValue(graph, set, definition)
    }))
}

/** What the root binds: its model, an item's value, `disabled`, and its variant props. */
function rootBindings(
  model: string | null,
  item: boolean,
  disabled: boolean,
  props: readonly VariantProp[]
): ComponentBinding[] {
  return [
    ...(model ? [{ type: 'model' as const, name: model }] : []),
    ...(item ? [{ type: 'value' as const }] : []),
    ...(disabled ? [{ type: 'disabled' as const }] : []),
    ...props.map((prop) => ({
      type: 'prop' as const,
      prop,
      attribute: propAttribute(prop.property)
    }))
  ]
}

/**
 * A group's items, built as the group's item component; null for other owners and for a
 * group's item itself.
 */
function itemsOf(
  graph: SceneGraph,
  behaviour: Behaviour,
  variantIds: readonly string[],
  parts: ReadonlyMap<StateElement, string>,
  options: ComponentModelOptions,
  build: (itemOf: GroupKind) => ItemBuilder
): ReturnType<typeof groupItems> {
  if (options.itemOf || !isGroup(behaviour.kind)) return null
  const itemsElement = [...parts].find(([, part]) => part === 'items')?.[0]
  return groupItems(graph, variantIds, itemsElement, build(behaviour.kind))
}

/**
 * The value the component binds two ways: `value` when it chooses among options or holds a
 * number or text, its boolean such as `checked`, or none for a group's item, which its group
 * chooses.
 */
function modelName(args: BehaviourArgs, item: boolean, valued: boolean): string | null {
  if (valued) return 'value'
  if (item) return null
  return [...args.booleans.values()].find((arg) => arg.name !== 'disabled')?.name ?? null
}

/** Whether the set draws a disabled look, as a boolean or an interaction state. */
const drawsDisabled = (args: BehaviourArgs) =>
  [...args.booleans.values()].some((arg) => arg.name === 'disabled') ||
  args.states?.disabled !== undefined

/** The layers used rather than drawn: a group's items, then other generated components. */
function usedLayers(
  graph: SceneGraph,
  root: StateElement,
  variantIds: readonly string[],
  items: ReadonlyMap<StateElement, UsedLayer> | undefined,
  references: ComponentReferences | undefined
): Map<StateElement, UsedLayer> {
  const used = new Map(items)
  if (references)
    for (const [element, layer] of referencedLayers(graph, root, variantIds, references, used))
      used.set(element, layer)
  return used
}

/**
 * Sizes the design gives include a layer's padding and border, which a component's own
 * stylesheet has to say, since no page reset around it does. A root without a width hugs its
 * content, as the design draws it.
 */
function borderBoxes(root: StateElement): void {
  // A root the design sizes to its content hugs it, where a block would fill its container.
  if (!Object.hasOwn(root.base, 'width')) root.base = { ...root.base, width: 'fit-content' }
  for (const element of allElements(root)) {
    const has = (property: string) => Object.hasOwn(element.base, property)
    if ((has('width') || has('height')) && !has('box-sizing'))
      element.base = { 'box-sizing': 'border-box', ...element.base }
  }
}

/**
 * Each layer's part, and tabs' triggers and panels, with the styles the generated parts need:
 * native buttons cleared, the chosen tab's look, and moving parts free of their drawn place.
 */
function drawnParts(
  graph: SceneGraph,
  set: SceneNode,
  behaviour: Behaviour | null,
  kind: GeneratedKind,
  root: StateElement
) {
  // A component without a behaviour has no parts but its root.
  const parts = behaviour
    ? behaviourParts(graph, set, behaviour, root)
    : new Map<StateElement, string>([[root, 'root']])
  const tabs = behaviour?.kind === 'tabs' ? tabParts(parts) : null
  const repeated = tabs?.repeated ?? new Map<StateElement, RepeatedPart>()
  activeTriggers(repeated)
  resetButtons(kind, parts, repeated)
  freePlacedParts(kind, parts)
  blockRoot(kind, root)
  borderBoxes(root)
  return { parts, tabs, repeated }
}

/** The number or text the component holds, and the text property a field's input shows. */
function valueModels(
  graph: SceneGraph,
  set: SceneNode,
  kind: GeneratedKind,
  behaviour: Behaviour | null,
  args: BehaviourArgs
): { range: RangeModel | null; text: TextModel | null; inputProperty: string | undefined } {
  if (!behaviour) return { range: null, text: null, inputProperty: undefined }
  const valueText = inputValue(kind)
  const inputProperty = valueText && textBinding(behaviour, valueText)
  const definition = behaviourProperties(graph, set).find((item) => item.id === inputProperty)
  return {
    range: rangeModel(kind, behaviour),
    text: textModel(kind, definition, args),
    inputProperty
  }
}

export function componentModel(
  graph: SceneGraph,
  set: SceneNode,
  options: ComponentModelOptions = {}
): ComponentModel | null {
  const behaviour = readBehaviour(set)
  // A component without a behaviour is plain: its properties are its props.
  const kind = behaviour ? generatedKind(behaviour.kind, options.itemOf) : 'plain'
  const styles = kind ? stateStyles(graph, set, options) : null
  const args = behaviourArgs(graph, set) ?? { booleans: new Map() }
  if (!kind || !styles) return null
  const name = options.name ?? identifierName(set.name, 'Component')

  const { parts, tabs, repeated } = drawnParts(graph, set, behaviour, kind, styles.root)

  // A group's items first, so its item component is used for them rather than a standalone one.
  const variantIds = [styles.restId, ...ownerVariants(graph, set).map((variant) => variant.id)]
  const items =
    behaviour &&
    itemsOf(
      graph,
      behaviour,
      variantIds,
      parts,
      options,
      (itemOf) => (owner) =>
        componentModel(graph, owner, {
          ...options,
          name: options.itemName ?? `${name}Item`,
          itemName: undefined,
          itemOf
        })
    )

  const choice = tabs?.choice ?? items?.choice ?? null
  const { range, text, inputProperty } = valueModels(graph, set, kind, behaviour, args)
  const model = modelName(args, !!options.itemOf, !!(choice ?? range ?? text))
  const taken = new Set([...(model ? [model] : []), 'disabled', 'value'])
  const props = variantProps(graph, set, args, taken)
  const disabled = drawsDisabled(args)
  const used = usedLayers(graph, styles.root, variantIds, items?.used, options.references)
  const elements = allElements(styles.root)
  const texts = textProps(graph, set, elements, taken, inputProperty)
  const input = inputLayers(texts.input)
  numberInput(input, range)
  const { booleans, shownBy } = booleanProps(graph, set, elements, taken)
  const { slots, slotOf } = slotProps(graph, set, elements, taken, parts)
  return {
    name,
    kind,
    styles,
    tree: componentTree(
      styles.root,
      {
        parts,
        classes: layerClassNames(styles),
        texts: texts.bound,
        used,
        repeated,
        input,
        shownBy,
        slotOf
      },
      rootBindings(model, !!options.itemOf, disabled, props)
    ),
    model,
    choice,
    range,
    text,
    valueProp: !!options.itemOf,
    item: items?.item ?? null,
    disabled,
    props,
    texts: texts.texts,
    booleans,
    slots,
    args
  }
}
