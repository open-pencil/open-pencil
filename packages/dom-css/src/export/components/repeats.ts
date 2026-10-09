import { difference } from '#dom-css/behaviours/states/model'
import type { StateElement, StateNode } from '#dom-css/behaviours/states/types'
import type { DesignStyleDeclaration } from '#dom-css/types'
import { isEmptyObject } from 'es-toolkit/predicate'
import { kebabCase } from 'es-toolkit/string'

import { claimName } from '../storybook/names'
import { isPlacement } from './references'

/** A layer drawn once per value, such as a tab's trigger or its panel, and the value it is. */
export interface RepeatedPart {
  part: string
  value: string
}

/**
 * The string a component chooses among, such as the open tab, and the one it starts on, or
 * none, as a radio group with no item chosen.
 */
export interface ChoiceModel {
  options: string[]
  default: string | null
}

/** The words a layer reads, joined across its text. */
export function textOf(node: StateNode): string {
  if (node.type === 'text') return node.text
  return node.children.map(textOf).join(' ')
}

const elementsOf = (element: StateElement | undefined) =>
  (element?.children ?? []).filter((child): child is StateElement => child.type === 'element')

/**
 * The value each label stands for: the label as a slug, such as `account`, apart from the
 * others, or its position when it has no words.
 */
export function slugValues(labels: readonly string[]): string[] {
  const taken = new Set<string>()
  return labels.map((label, index) => claimName(kebabCase(label) || String(index), taken))
}

/**
 * Tabs' triggers, the layers in its list, and its panels, the layers in its panels slot, each
 * with the value of the tab it belongs to, matched by position. The tabs start on the first.
 */
export function tabParts(parts: ReadonlyMap<StateElement, string>): {
  repeated: Map<StateElement, RepeatedPart>
  choice: ChoiceModel | null
} {
  const partElement = (id: string) => [...parts].find(([, part]) => part === id)?.[0]
  const triggers = elementsOf(partElement('list'))
  const values = slugValues(triggers.map(textOf))
  const repeated = new Map<StateElement, RepeatedPart>()
  for (const [index, trigger] of triggers.entries())
    repeated.set(trigger, { part: 'trigger', value: values[index] ?? String(index) })
  for (const [index, panel] of elementsOf(partElement('panels')).entries()) {
    const value = values.at(index)
    if (value !== undefined) repeated.set(panel, { part: 'content', value })
  }
  const first = values.at(0)
  return { repeated, choice: first === undefined ? null : { options: values, default: first } }
}

/** How `drawn` looks different from `base`, leaving out where each is placed. */
function lookChange(
  base: DesignStyleDeclaration,
  drawn: DesignStyleDeclaration
): DesignStyleDeclaration {
  const changed = Object.entries(difference(base, drawn))
  return Object.fromEntries(changed.filter(([property]) => !isPlacement(property)))
}

/** `base` with `change` applied, where `unset` drops a declaration. */
function applied(
  base: DesignStyleDeclaration,
  change: DesignStyleDeclaration
): DesignStyleDeclaration {
  return Object.fromEntries([
    ...Object.entries(base).filter(([property]) => change[property] !== 'unset'),
    ...Object.entries(change).filter(([, value]) => value !== 'unset')
  ])
}

/** The layer of `into` where `from` has `child`: the same name, and the same one of that name. */
function counterpart(
  child: StateElement,
  from: StateElement,
  into: StateElement
): StateElement | undefined {
  const named = (element: StateElement) =>
    elementsOf(element).filter((item) => item.name === child.name)
  return named(into).at(named(from).indexOf(child))
}

/**
 * Tabs draw the first trigger chosen and the others not. Every trigger rests with the look of
 * the others and takes the first one's, layer by layer, while Reka or Radix marks it active;
 * each keeps its own place. A layer is matched across triggers by name, and one without a
 * counterpart keeps its own styles.
 */
export function activeTriggers(repeated: ReadonlyMap<StateElement, RepeatedPart>): void {
  const triggers = [...repeated].filter(([, item]) => item.part === 'trigger').map(([el]) => el)
  const first = triggers.at(0)
  const second = triggers.at(1)
  if (!first || !second) return
  // The two looks as drawn, before the first trigger rests with the others' look.
  const [active, inactive] = structuredClone([first, second])
  for (const trigger of triggers) {
    const visit = (layer: StateElement, drawn: StateElement, other: StateElement) => {
      if (trigger === first) layer.base = applied(layer.base, lookChange(drawn.base, other.base))
      // From the layer's own rest, so a trigger drawn apart still takes the chosen look.
      const look = lookChange(layer.base, drawn.base)
      if (!isEmptyObject(look))
        layer.rules.push({
          conditions: [{ type: 'state', value: 'active' }],
          on: trigger,
          style: look
        })
      for (const child of elementsOf(layer)) {
        const drawnChild = counterpart(child, layer, drawn)
        const otherChild = counterpart(child, layer, other)
        if (drawnChild && otherChild) visit(child, drawnChild, otherChild)
      }
    }
    visit(trigger, active, inactive)
  }
}
