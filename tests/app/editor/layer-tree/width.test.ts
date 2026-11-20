import { describe, expect, test } from 'bun:test'

import type { LayerRow } from '@open-pencil/vue/primitives/LayerTree'

import {
  type LayerRowDecorations,
  type LayerRowMetrics,
  rowsOverflow
} from '@/components/LayerTree/width'

const metrics: LayerRowMetrics = {
  font: 'name',
  badgeFont: 'badge',
  indent: 16,
  nameStart: 36,
  badge: 14,
  rowEnd: 8,
  trailingGap: 4,
  issueMark: 16,
  buttons: 34,
  viewportWidth: 200
}

function measure(text: string, font: string): number {
  if (text === '…') {
    return 8
  }
  return text.length * (font === 'badge' ? 5 : 10)
}

function row(name: string, level = 1, flags: { locked?: boolean; visible?: boolean } = {}) {
  const node = {
    id: `${name}-${level}`,
    name,
    type: 'FRAME',
    layoutMode: 'NONE',
    visible: flags.visible ?? true,
    locked: flags.locked ?? false
  }
  return { node, level, hasChildren: false } satisfies LayerRow
}

function decorations(options: { modes?: number; issue?: boolean } = {}): LayerRowDecorations {
  return {
    modeCount: () => options.modes ?? 0,
    showsIssue: () => options.issue ?? false,
    buttonsAlwaysShown: (layer) => layer.node.locked || !layer.node.visible
  }
}

describe('layer rows overflow', () => {
  test('a shallow row with a normal name fits the list idle and hovered', () => {
    expect(rowsOverflow([row('Card title')], metrics, decorations(), measure)).toBe(0)
  })

  test('a long name widens the list by what its idle row needs', () => {
    expect(rowsOverflow([row('x'.repeat(20))], metrics, decorations(), measure)).toBe(44)
  })

  test('a deep short name widens the list for its hovered buttons, ellipsis, and badge', () => {
    expect(rowsOverflow([row('A', 11)], metrics, decorations({ modes: 1 }), measure)).toBe(65)
  })

  test('a locked or hidden row holds its whole name beside the buttons it always shows', () => {
    const shown = decorations({ modes: 1 })
    expect(rowsOverflow([row('A', 11, { locked: true })], metrics, shown, measure)).toBe(67)
    expect(rowsOverflow([row('A', 11, { visible: false })], metrics, shown, measure)).toBe(67)
  })

  test('an issue mark sits a gap before the hovered buttons', () => {
    const narrow = { ...metrics, viewportWidth: 100 }
    expect(rowsOverflow([row('A')], narrow, decorations({ issue: true }), measure)).toBe(6)
  })

  test('the widest row sets the overflow', () => {
    const rows = [row('Card title'), row('A', 11), row('x'.repeat(20))]
    expect(rowsOverflow(rows, metrics, decorations({ modes: 1 }), measure)).toBe(65)
  })

  test('rows are not measured before the list has a font', () => {
    const unstyled = { ...metrics, font: '' }
    expect(rowsOverflow([row('x'.repeat(40))], unstyled, decorations(), measure)).toBe(0)
  })
})
