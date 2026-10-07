import { sceneNodeToDesignDocument } from '#dom-css/export/projection'
import type { DesignElement, DesignNode, DesignStyleDeclaration, DesignText } from '#dom-css/types'
import { omit } from 'es-toolkit/object'
import { isEqual } from 'es-toolkit/predicate'

import {
  behaviourProperties,
  layerPath,
  readBehaviour,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import { behaviourArgs, type BooleanArg } from '../args'

/**
 * What must hold on a control's root for a variant to show. Reka and Radix set `data-state`
 * and `data-disabled` themselves; the browser sets the interactions; a generated component
 * sets `data-*` from its props for every other variant property.
 */
export type StateCondition =
  | { type: 'state'; value: string }
  | { type: 'disabled' }
  | { type: 'interaction'; state: 'hover' | 'pressed' | 'focus' }
  | { type: 'prop'; name: string; value: string }

export interface StateRule {
  conditions: StateCondition[]
  style: DesignStyleDeclaration
}

/** A layer of the merged markup: its rest style and what each other variant changes. */
export interface StateElement {
  type: 'element'
  /** The layer path below the set's variant, with text content when variants differ there. */
  key: string
  /** The layer's name, for class names. */
  name: string
  tagName: string
  attrs: Record<string, string>
  base: DesignStyleDeclaration
  rules: StateRule[]
  children: StateNode[]
}

export type StateNode = StateElement | DesignText

export interface StateStyles {
  /** The set's name, for the root's class name. */
  name: string
  root: StateElement
}

/** The `data-state` values a boolean prop shows on and off, as Reka and Radix set them. */
const DATA_STATES: Partial<Record<string, { on: string; off: string }>> = {
  checked: { on: 'checked', off: 'unchecked' },
  pressed: { on: 'on', off: 'off' },
  open: { on: 'open', off: 'closed' }
}

const INTERACTIONS = ['hover', 'pressed', 'focus'] as const

/** How each value of each variant property reads as a condition; `null` for the rest value. */
type PropertyConditions = Map<string, (value: string) => StateCondition | null>

function booleanConditions(arg: BooleanArg): (value: string) => StateCondition | null {
  return (value) => {
    if (value === arg.off) return null
    if (arg.name === 'disabled') return { type: 'disabled' }
    const state = DATA_STATES[arg.name]
    return state ? { type: 'state', value: state.on } : { type: 'prop', name: arg.name, value }
  }
}

function propertyConditions(graph: SceneGraph, set: SceneNode): PropertyConditions {
  const args = behaviourArgs(graph, set)
  const states = args?.states
  const stored = readBehaviour(set)?.states
  const interactions = new Map<string, StateCondition>()
  for (const state of INTERACTIONS) {
    const value = stored?.[state]
    if (value !== undefined && value !== states?.rest)
      interactions.set(value, { type: 'interaction', state })
  }
  if (states?.disabled !== undefined) interactions.set(states.disabled, { type: 'disabled' })

  const conditions: PropertyConditions = new Map()
  for (const definition of behaviourProperties(graph, set)) {
    if (definition.type !== 'VARIANT') continue
    const { name } = definition
    const boolean = args?.booleans.get(name)
    const rest = states?.property === name ? states.rest : definition.defaultValue
    conditions.set(
      name,
      boolean
        ? booleanConditions(boolean)
        : (value) =>
            value === rest
              ? null
              : ((states?.property === name ? interactions.get(value) : undefined) ?? {
                  type: 'prop',
                  name,
                  value
                })
    )
  }
  return conditions
}

/** One variant projected, its elements keyed for matching across variants. */
interface KeyedElement {
  type: 'element'
  key: string
  name: string
  element: DesignElement
  children: Array<KeyedElement | DesignText>
}

function textContent(element: DesignElement): string | null {
  const texts = element.children.filter((child): child is DesignText => child.type === 'text')
  return texts.length > 0 ? texts.map((text) => text.text).join('') : null
}

function keyed(
  graph: SceneGraph,
  variant: SceneNode,
  node: DesignNode,
  parentKey: string,
  index: number
): KeyedElement | DesignText {
  if (node.type === 'text') return node
  const source = node.sourceSceneNodeId
  const path = source ? layerPath(graph, variant.id, source) : `${parentKey}/~${index}`
  const text = textContent(node)
  // A label that reads differently in a variant is a different layer, shown by its state.
  const key = text === null ? path : `${path}\0${text}`
  return {
    type: 'element',
    key,
    name: node.sourceSceneNode?.name ?? node.tagName,
    element: node,
    children: node.children.map((child, i) => keyed(graph, variant, child, key, i))
  }
}

/** Where the set places a variant, which is not the component's own style. */
const PLACEMENT = ['position', 'left', 'top', 'right', 'bottom', 'inset']

function project(graph: SceneGraph, variant: SceneNode): KeyedElement | null {
  const document = sceneNodeToDesignDocument(graph, variant.id, { includeSourceIds: false })
  const root = document.children.at(0)
  if (root?.type !== 'element') return null
  const style = root.inlineStyle ?? {}
  // Absolutely placed layers inside still need the root as their containing block.
  root.inlineStyle = {
    ...omit(style, PLACEMENT),
    ...(style.position ? { position: 'relative' } : {})
  }
  return {
    type: 'element',
    key: '',
    name: variant.name,
    element: root,
    children: root.children.map((child, i) => keyed(graph, variant, child, '', i))
  }
}

function flatten(element: KeyedElement, into = new Map<string, KeyedElement>()) {
  into.set(element.key, element)
  for (const child of element.children) if (child.type !== 'text') flatten(child, into)
  return into
}

/** Declarations `next` sets differently from `base`, with `unset` for ones it drops. */
function difference(
  base: DesignStyleDeclaration,
  next: DesignStyleDeclaration
): DesignStyleDeclaration {
  const changed: DesignStyleDeclaration = {}
  for (const [property, value] of Object.entries(next))
    if (base[property] !== value) changed[property] = value
  for (const property of Object.keys(base)) if (!(property in next)) changed[property] = 'unset'
  return changed
}

function isEmpty(style: DesignStyleDeclaration): boolean {
  return Object.keys(style).length === 0
}

function stateElement(source: KeyedElement): StateElement {
  return {
    type: 'element',
    key: source.key,
    name: source.name,
    tagName: source.element.tagName,
    attrs: { ...source.element.attrs },
    base: { ...source.element.inlineStyle },
    rules: [],
    children: source.children.map((child) => (child.type === 'text' ? child : stateElement(child)))
  }
}

/** Adds layers only `variant` has to the merged tree, after the sibling they follow there. */
function merge(into: StateElement, variant: KeyedElement, hidden: Set<string>): void {
  let after = -1
  for (const child of variant.children) {
    if (child.type === 'text') continue
    const existing = into.children.findIndex(
      (item) => item.type === 'element' && item.key === child.key
    )
    if (existing === -1) {
      const added = stateElement(child)
      hideSubtree(added, hidden)
      into.children.splice(after + 1, 0, added)
      after += 1
    } else {
      after = existing
      const target = into.children.at(existing)
      if (target?.type === 'element') merge(target, child, hidden)
    }
  }
}

/** Layers the base variant lacks: hidden at rest, each with its own style kept for its state. */
function hideSubtree(element: StateElement, hidden: Set<string>): void {
  hidden.add(element.key)
  for (const child of element.children) if (child.type === 'element') hideSubtree(child, hidden)
}

function conditionsFor(
  variant: SceneNode,
  conditions: PropertyConditions
): StateCondition[] | null {
  const result: StateCondition[] = []
  for (const [property, read] of conditions) {
    // A variant that leaves a property out can't be placed among the others.
    if (!Object.hasOwn(variant.componentPropertyValues, property)) return null
    const condition = read(variant.componentPropertyValues[property])
    if (condition) result.push(condition)
  }
  return result
}

function allElements(element: StateElement, into: StateElement[] = []): StateElement[] {
  into.push(element)
  for (const child of element.children) if (child.type === 'element') allElements(child, into)
  return into
}

const isSubset = (part: StateCondition[], whole: StateCondition[]) =>
  part.length < whole.length &&
  part.every((condition) => whole.some((other) => isEqual(condition, other)))

/**
 * Drops what a combined variant repeats: a declaration every smaller rule that sets the
 * property already gives, since those rules apply too. Rules left empty go.
 */
function pruneCombined(element: StateElement): void {
  const original = element.rules.map((rule) => ({ ...rule, style: { ...rule.style } }))
  element.rules = element.rules.flatMap((rule) => {
    const parts = original.filter((other) => isSubset(other.conditions, rule.conditions))
    const style = Object.fromEntries(
      Object.entries(rule.style).filter(([property, value]) => {
        const given = parts.flatMap((part) =>
          property in part.style ? [part.style[property]] : []
        )
        return given.length === 0 || given.some((other) => other !== value)
      })
    )
    return isEmpty(style) ? [] : [{ ...rule, style }]
  })
}

/**
 * What a variant changes on a layer: its differing declarations where it draws the layer,
 * shown again if the rest variant hides it, and hidden where it does not draw the layer.
 */
function variantStyle(
  element: StateElement,
  source: KeyedElement | undefined,
  hiddenAtRest: boolean
): DesignStyleDeclaration {
  if (!source) return element.base.display === 'none' ? {} : { display: 'none' }
  const drawn = source.element.inlineStyle ?? {}
  return difference(
    element.base,
    hiddenAtRest
      ? { ...drawn, display: Object.hasOwn(drawn, 'display') ? drawn.display : 'revert' }
      : drawn
  )
}

/**
 * A component set's variants as one markup tree with a rest style per layer and a rule per
 * variant holding only what that variant changes, under the conditions that show it. Layers
 * only some variants have stay in the tree, hidden where absent. Null when the set has no
 * variants to compare.
 */
export function stateStyles(graph: SceneGraph, set: SceneNode): StateStyles | null {
  const conditions = propertyConditions(graph, set)
  const variants = graph
    .getChildren(set.id)
    .filter((child) => child.type === 'COMPONENT' && child.visible)
    .flatMap((variant) => {
      const when = conditionsFor(variant, conditions)
      const projected = when && project(graph, variant)
      return when && projected ? [{ variant, when, projected }] : []
    })
  const base = variants.find((item) => item.when.length === 0) ?? variants.at(0)
  if (!base) return null

  const root = stateElement(base.projected)
  const hidden = new Set<string>()
  for (const item of variants) if (item !== base) merge(root, item.projected, hidden)
  const elements = allElements(root)
  // A layer missing at rest keeps its first drawn style for the variants that show it.
  const firstStyle = new Map<string, DesignStyleDeclaration>()
  for (const item of variants)
    for (const [key, source] of flatten(item.projected))
      if (!firstStyle.has(key)) firstStyle.set(key, { ...source.element.inlineStyle })
  for (const element of elements)
    if (hidden.has(element.key)) element.base = { ...firstStyle.get(element.key), display: 'none' }

  for (const item of variants) {
    if (item === base) continue
    const present = flatten(item.projected)
    for (const element of elements) {
      const style = variantStyle(element, present.get(element.key), hidden.has(element.key))
      if (!isEmpty(style)) element.rules.push({ conditions: item.when, style })
    }
  }
  for (const element of elements) pruneCombined(element)
  return { name: set.name, root }
}
