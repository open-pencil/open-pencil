import { describe, expect, test } from 'bun:test'

import type { StateElement } from '#dom-css/behaviours/states/types'
import { activeTriggers, type RepeatedPart } from '#dom-css/export/components/repeats'
import type { DesignStyleDeclaration } from '#dom-css/types'

function layer(
  name: string,
  base: DesignStyleDeclaration,
  children: StateElement[] = []
): StateElement {
  return { type: 'element', key: name, name, tagName: 'div', attrs: {}, base, rules: [], children }
}

/** A trigger with an icon and a label in `order`. */
function trigger(
  background: string,
  [icon, label, weight]: [string, string, string],
  order: 'icon first' | 'label first'
) {
  const layers = [
    layer('Icon', { color: icon }),
    layer('Label', { color: label, 'font-weight': weight })
  ]
  return layer(
    'Trigger',
    { 'background-color': background },
    order === 'icon first' ? layers : layers.reverse()
  )
}

function triggers(...elements: StateElement[]): Map<StateElement, RepeatedPart> {
  return new Map(
    elements.map((element, index) => [element, { part: 'trigger', value: String(index) }])
  )
}

const active = (element: StateElement | undefined, on: StateElement) =>
  element?.rules.find((rule) => rule.on === on && rule.conditions.at(0)?.type === 'state')?.style

const child = (element: StateElement, name: string) =>
  element.children.find(
    (item): item is StateElement => item.type === 'element' && item.name === name
  )

describe('tab triggers', () => {
  test('take the first trigger’s look while active, from their own rest and layer by name', () => {
    const chosen = trigger('#111', ['#999', '#fff', '400'], 'icon first')
    const plain = trigger('#eee', ['#555', '#333', '400'], 'icon first')
    // Drawn apart from the others, in bold with its layers in another order.
    const apart = trigger('#eee', ['#555', '#333', '700'], 'label first')
    activeTriggers(triggers(chosen, plain, apart))

    expect(chosen.base).toEqual({ 'background-color': '#eee' })
    expect(child(chosen, 'Label')?.base).toEqual({ color: '#333', 'font-weight': '400' })
    for (const each of [chosen, plain]) {
      expect(active(each, each)).toEqual({ 'background-color': '#111' })
      expect(active(child(each, 'Icon'), each)).toEqual({ color: '#999' })
      expect(active(child(each, 'Label'), each)).toEqual({ color: '#fff' })
    }
    expect(active(child(apart, 'Icon'), apart)).toEqual({ color: '#999' })
    expect(active(child(apart, 'Label'), apart)).toEqual({ color: '#fff', 'font-weight': '400' })
    // At rest it keeps its own look.
    expect(child(apart, 'Label')?.base).toEqual({ color: '#333', 'font-weight': '700' })
  })
})
