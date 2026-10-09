import type { StateElement, StateNode } from '#dom-css/behaviours/states/types'
import { kebabCase } from 'es-toolkit/string'

import { claimName } from '../storybook/names'

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
