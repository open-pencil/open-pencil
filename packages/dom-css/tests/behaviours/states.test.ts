import { describe, expect, test } from 'bun:test'

import {
  stateStyles,
  stateStylesToCSS,
  stateStylesToTailwind,
  type StateElement,
  type StateStyles
} from '#dom-css/behaviours/states/index'
import { compileTailwindCSS } from '#dom-css/import/tailwind'
import type { DesignElement, DesignNode } from '#dom-css/types'
import { parse, type CSSStyleRuleLike } from '@acemir/cssom'

import { emptyBehaviour } from '@open-pencil/scene-graph'

import { buttonSet, checkboxSet, componentSet, switchSet, toggleSet } from './fixtures'

function styles(fixture: ReturnType<typeof switchSet>): StateStyles {
  const result = stateStyles(fixture.graph, fixture.set)
  if (!result) throw new Error('No state styles')
  return result
}

function child(element: StateElement, key: string): StateElement {
  const found = element.children.find(
    (item): item is StateElement => item.type === 'element' && item.key === key
  )
  if (!found) throw new Error(`No layer ${JSON.stringify(key)}`)
  return found
}

/** Every style rule of a stylesheet, by selector, including ones inside media queries. */
function cssRules(css: string): Map<string, Record<string, string>> {
  const rules = new Map<string, Record<string, string>>()
  const visit = (list: ArrayLike<unknown>) => {
    for (const item of Array.from(list)) {
      const rule = item as CSSStyleRuleLike & { cssRules?: ArrayLike<unknown> }
      if (rule.cssRules) visit(rule.cssRules)
      if (!rule.selectorText) continue
      const style: Record<string, string> = {}
      for (const property of Array.from({ length: rule.style.length }, (_, i) => rule.style[i]))
        if (property) style[property] = rule.style.getPropertyValue(property)
      rules.set(rule.selectorText, style)
    }
  }
  visit(parse(css).cssRules)
  return rules
}

/**
 * Tailwind's compiled rules as selector and declarations. Its escaped class selectors are
 * beyond the CSSOM parser, so innermost `selector { … }` blocks are read directly, which also
 * reaches rules nested in `@media`.
 */
function compiledRules(css: string): [string, string][] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => [
    (match[1] ?? '').trim(),
    (match[2] ?? '').trim()
  ])
}

function elements(node: DesignNode, into: DesignElement[] = []): DesignElement[] {
  if (node.type !== 'element') return into
  into.push(node)
  for (const item of node.children) elements(item, into)
  return into
}

describe('state styles', () => {
  test('keeps the rest variant as base and each other variant as only what it changes', () => {
    const { root } = styles(switchSet())
    expect(root.base).toEqual({
      width: '40px',
      height: '22px',
      'background-color': '#CCD6E0',
      position: 'relative'
    })
    expect(root.rules).toEqual([
      {
        conditions: [{ type: 'interaction', state: 'hover' }],
        style: { 'background-color': '#B8C4D6' }
      },
      { conditions: [{ type: 'disabled' }], style: { opacity: '0.5' } },
      {
        conditions: [{ type: 'state', value: 'checked' }],
        style: { 'background-color': '#4F45E6' }
      },
      // Hover alone would paint a checked switch grey, so the combination keeps its fill.
      {
        conditions: [
          { type: 'state', value: 'checked' },
          { type: 'interaction', state: 'hover' }
        ],
        style: { 'background-color': '#4F45E6' }
      }
    ])
    expect(child(root, 'Thumb').rules).toEqual([
      { conditions: [{ type: 'state', value: 'checked' }], style: { left: '20px' } }
    ])
  })

  test('hides a layer at rest that only a state draws', () => {
    const indicator = child(styles(checkboxSet()).root, 'Indicator')
    expect(indicator.base.display).toBe('none')
    expect(indicator.rules).toEqual([
      { conditions: [{ type: 'state', value: 'checked' }], style: { display: 'revert' } }
    ])
  })

  test('keeps a label that reads differently as a layer per state', () => {
    const { root } = styles(toggleSet())
    expect(child(root, 'Label\0Off').rules).toEqual([
      { conditions: [{ type: 'state', value: 'on' }], style: { display: 'none' } }
    ])
    expect(child(root, 'Label\0On').base.display).toBe('none')
  })

  test('reads other variant properties as props, so missing combinations combine', () => {
    const { root } = styles(buttonSet())
    expect(root.rules).toEqual([
      {
        conditions: [{ type: 'interaction', state: 'hover' }],
        style: { 'background-color': '#B8C4D6' }
      },
      { conditions: [{ type: 'prop', name: 'Size', value: 'Large' }], style: { width: '160px' } }
    ])
  })
})

test('has no state styles when no variant shows the rest state', () => {
  // Only the checked variant is drawn; using it as the base would show it checked at rest.
  const { graph, set } = componentSet(
    'Switch',
    { State: ['Off', 'On'] },
    {
      ...emptyBehaviour('switch'),
      booleans: { value: { propertyId: 'state', on: 'On', off: 'Off' } }
    },
    () => undefined,
    ({ State }) => State === 'Off'
  )
  expect(stateStyles(graph, set)).toBeNull()
})

describe('state stylesheet', () => {
  test('writes readable classes and state selectors on the root', async () => {
    const { document, css } = await stateStylesToCSS(styles(switchSet()))
    expect(
      elements(document.children[0] ?? { type: 'text', text: '' }).map((el) => el.attrs.class)
    ).toEqual(['switch', 'switch__thumb'])
    const rules = cssRules(css)
    expect(rules.get('.switch[data-state="checked"] .switch__thumb')).toEqual({ left: '20px' })
    expect(rules.get('.switch:hover:not([data-disabled])')).toEqual({
      'background-color': '#B8C4D6'
    })
    expect(rules.get('.switch[data-state="checked"]:hover:not([data-disabled])')).toEqual({
      'background-color': '#4F45E6'
    })
    expect(rules.get('.switch[data-disabled]')).toEqual({ opacity: '0.5' })
    // Fewer conditions come first, so the cascade never depends on emission order.
    expect(css.indexOf('.switch[data-state="checked"] {')).toBeGreaterThan(-1)
    expect(css.indexOf('.switch[data-state="checked"] {')).toBeLessThan(
      css.indexOf('.switch[data-state="checked"]:hover')
    )
  })

  test('writes a prop condition as the data attribute a component sets', async () => {
    const rules = cssRules((await stateStylesToCSS(styles(buttonSet()))).css)
    expect(rules.get('.button[data-size="Large"]')).toEqual({ width: '160px' })
  })
})

describe('state Tailwind', () => {
  test('writes state variants that Tailwind compiles to the same selectors', async () => {
    const document = stateStylesToTailwind(styles(switchSet()))
    const [root, thumb] = elements(document.children[0] ?? { type: 'text', text: '' })
    const rootClasses = root?.attrs.class.split(' ') ?? []
    const thumbClasses = thumb?.attrs.class.split(' ') ?? []
    expect(rootClasses).toContain('group/switch')
    expect(thumbClasses).toContain('group-data-[state=checked]/switch:left-5')

    const rules = compiledRules(await compileTailwindCSS([...rootClasses, ...thumbClasses]))
    const declaring = (property: string, matches: (selector: string) => boolean) =>
      rules.filter(([selector, body]) => matches(selector) && body.startsWith(`${property}:`))
    // The thumb moves when its own root is checked, found through the named group.
    expect(
      declaring('left', (selector) =>
        selector.endsWith(':is(:where(.group\\/switch)[data-state="checked"] *)')
      )
    ).toHaveLength(1)
    // Hover excludes a disabled root, and a checked hover is more specific than either part.
    expect(
      declaring('background-color', (selector) =>
        selector.endsWith('[data-state="checked"]:not([data-disabled]):hover')
      )
    ).toHaveLength(1)
  })
})
