import { describe, expect, test } from 'bun:test'

import { hasInstanceOverride } from '@open-pencil/scene-graph/instances'
import { expectDefined, getNodeOrThrow } from '@open-pencil/test-support/assert'

import { parseDocument } from '../helpers/document'
import { copyOf } from '../helpers/instances'
import { DARK_SURFACE, LIGHT_SURFACE, lightDark, SEMANTIC_THEMES, SURFACE } from '../helpers/themes'

// pen.dev 2.21: a copy is read in the theme of the screen it is placed in, not the theme its
// component was read in (#2170).
describe('parsePenFile — instance themes', () => {
  test('resolves a nested instance in the theme of the screen it is placed in', () => {
    const graph = parseDocument(
      [
        {
          id: 'Card',
          type: 'frame',
          reusable: true,
          layout: 'vertical',
          gap: '$space',
          width: 100,
          height: 60,
          fill: '$surface',
          children: [{ id: 'caption', type: 'text', content: 'Caption', fill: '$surface' }]
        },
        {
          id: 'Row',
          type: 'frame',
          reusable: true,
          layout: 'horizontal',
          children: [{ id: 'RowCard', type: 'ref', ref: 'Card' }]
        },
        {
          id: 'Dark',
          type: 'frame',
          theme: { semantic: 'dark' },
          fill: '$surface',
          children: [
            { id: 'DirectCard', type: 'ref', ref: 'Card' },
            { id: 'RowInst', type: 'ref', ref: 'Row' }
          ]
        }
      ],
      {
        themes: SEMANTIC_THEMES,
        variables: { surface: SURFACE, space: lightDark('number', 4, 16) }
      }
    )
    const fill = (id: string) => getNodeOrThrow(graph, id).fills[0]?.color
    const nested = copyOf(graph, 'RowInst', 'RowCard')

    expect(fill('DirectCard')).toEqual(DARK_SURFACE)
    expect(fill('Dark')).toEqual(DARK_SURFACE)
    expect(nested.fills[0]?.color).toEqual(DARK_SURFACE)
    expect(nested.itemSpacing).toBe(16)
    expect(copyOf(graph, nested.id, 'caption').fills[0]?.color).toEqual(DARK_SURFACE)
    expect(copyOf(graph, 'DirectCard', 'caption').fills[0]?.color).toEqual(DARK_SURFACE)
    // The component keeps the default theme it was read in.
    expect(fill('Card')).toEqual(LIGHT_SURFACE)
    expect(fill('RowCard')).toEqual(LIGHT_SURFACE)
    expect(getNodeOrThrow(graph, 'RowCard').itemSpacing).toBe(4)
  })

  test('merges the screen theme under a theme the nested instance sets', () => {
    const graph = parseDocument(
      [
        {
          id: 'Card',
          type: 'frame',
          reusable: true,
          layout: 'vertical',
          gap: '$gap',
          width: 40,
          height: 40,
          fill: '$accent'
        },
        {
          id: 'Row',
          type: 'frame',
          reusable: true,
          children: [{ id: 'RowCard', type: 'ref', ref: 'Card', theme: { density: 'cozy' } }]
        },
        {
          id: 'Dark',
          type: 'frame',
          theme: { mode: 'dark' },
          children: [
            { id: 'DirectCard', type: 'ref', ref: 'Card', theme: { density: 'cozy' } },
            { id: 'RowInst', type: 'ref', ref: 'Row' }
          ]
        }
      ],
      {
        themes: { mode: ['light', 'dark'], density: ['compact', 'cozy'] },
        variables: {
          accent: {
            type: 'color',
            value: [
              { value: '#CC0000', theme: { mode: 'light', density: 'compact' } },
              { value: '#00CC00', theme: { mode: 'dark' } },
              { value: '#0000CC', theme: { mode: 'light', density: 'cozy' } }
            ]
          },
          gap: {
            type: 'number',
            value: [
              { value: 4, theme: { density: 'compact' } },
              { value: 16, theme: { density: 'cozy' } }
            ]
          }
        }
      }
    )
    const nested = copyOf(graph, 'RowInst', 'RowCard')
    const green = { r: 0, g: 0.8, b: 0, a: 1 }

    expect(getNodeOrThrow(graph, 'DirectCard').fills[0]?.color).toEqual(green)
    expect(nested.fills[0]?.color).toEqual(green)
    expect(nested.itemSpacing).toBe(16)
  })

  // The override themes the copy and the layers under it, not the screen theme from before it.
  test('resolves a nested instance in the theme a descendant override sets', () => {
    const graph = parseDocument(
      [
        {
          id: 'B',
          type: 'frame',
          reusable: true,
          fill: '$surface',
          children: [{ id: 'label', type: 'text', content: 'Label', fill: '$surface' }]
        },
        {
          id: 'A',
          type: 'frame',
          reusable: true,
          children: [{ id: 'AB', type: 'ref', ref: 'B' }]
        },
        {
          id: 'Dark',
          type: 'frame',
          theme: { semantic: 'dark' },
          fill: '$surface',
          children: [
            {
              id: 'placed',
              type: 'ref',
              ref: 'A',
              descendants: { AB: { theme: { semantic: 'light' } } }
            }
          ]
        }
      ],
      { themes: SEMANTIC_THEMES, variables: { surface: SURFACE } }
    )
    const nested = copyOf(graph, 'placed', 'AB')

    expect(getNodeOrThrow(graph, 'Dark').fills[0]?.color).toEqual(DARK_SURFACE)
    expect(nested.fills[0]?.color).toEqual(LIGHT_SURFACE)
    expect(copyOf(graph, nested.id, 'label').fills[0]?.color).toEqual(LIGHT_SURFACE)
    // The component keeps the default theme it was read in.
    for (const id of ['B', 'AB', 'label']) {
      expect(getNodeOrThrow(graph, id).fills[0]?.color).toEqual(LIGHT_SURFACE)
    }
  })

  // A swap's theme reaches the component it swaps in, not the screen theme from before the swap.
  test('resolves a swapped nested instance in the theme the replacement sets', () => {
    const graph = parseDocument(
      [
        {
          id: 'B',
          type: 'frame',
          reusable: true,
          fill: '$surface',
          children: [{ id: 'bLabel', type: 'text', content: 'B', fill: '$surface' }]
        },
        {
          id: 'C',
          type: 'frame',
          reusable: true,
          fill: '$surface',
          children: [{ id: 'cLabel', type: 'text', content: 'C', fill: '$surface' }]
        },
        {
          id: 'A',
          type: 'frame',
          reusable: true,
          children: [{ id: 'AB', type: 'ref', ref: 'B' }]
        },
        {
          id: 'Dark',
          type: 'frame',
          theme: { semantic: 'dark' },
          fill: '$surface',
          children: [
            {
              id: 'placed',
              type: 'ref',
              ref: 'A',
              descendants: { AB: { type: 'ref', ref: 'C', theme: { semantic: 'light' } } }
            }
          ]
        }
      ],
      { themes: SEMANTIC_THEMES, variables: { surface: SURFACE } }
    )
    const swapped = expectDefined(graph.getChildren('placed')[0], 'swapped AB')

    expect(getNodeOrThrow(graph, 'Dark').fills[0]?.color).toEqual(DARK_SURFACE)
    expect(swapped).toMatchObject({ type: 'INSTANCE', componentId: 'C' })
    expect(swapped.fills[0]?.color).toEqual(LIGHT_SURFACE)
    expect(copyOf(graph, swapped.id, 'cLabel').fills[0]?.color).toEqual(LIGHT_SURFACE)
    // The component keeps the default theme it was read in.
    for (const id of ['C', 'cLabel']) {
      expect(getNodeOrThrow(graph, id).fills[0]?.color).toEqual(LIGHT_SURFACE)
    }
  })

  // A theme re-read changes the clip before an override snapshots the copy, so the change has to
  // be recorded then: a sync otherwise puts the component's clip back.
  test('keeps a theme-bound clip on a nested instance through a sync of its component', () => {
    const graph = parseDocument(
      [
        {
          id: 'Card',
          type: 'frame',
          reusable: true,
          layout: 'vertical',
          gap: '$space',
          clip: '$clip',
          width: 80,
          height: 40
        },
        {
          id: 'Row',
          type: 'frame',
          reusable: true,
          children: [{ id: 'RowCard', type: 'ref', ref: 'Card' }]
        },
        {
          id: 'Dark',
          type: 'frame',
          theme: { semantic: 'dark' },
          children: [
            { id: 'Plain', type: 'ref', ref: 'Row' },
            {
              id: 'RowInst',
              type: 'ref',
              ref: 'Row',
              descendants: { RowCard: { theme: { semantic: 'dark' } } }
            }
          ]
        }
      ],
      {
        themes: SEMANTIC_THEMES,
        variables: {
          clip: lightDark('boolean', false, true),
          space: lightDark('number', 4, 16)
        }
      }
    )
    const plain = expectDefined(graph.getChildren('Plain')[0], 'plain card')
    const overridden = expectDefined(graph.getChildren('RowInst')[0], 'themed card')

    expect(getNodeOrThrow(graph, 'Card').clipsContent).toBe(false)
    expect(getNodeOrThrow(graph, 'RowCard').clipsContent).toBe(false)
    expect(plain.clipsContent).toBe(true)
    expect(overridden.clipsContent).toBe(true)
    expect(plain.itemSpacing).toBe(16)
    expect(hasInstanceOverride(graph, overridden.id, 'variableModes')).toBe(true)
    expect(hasInstanceOverride(graph, plain.id, 'clipsContent')).toBe(true)
    expect(hasInstanceOverride(graph, overridden.id, 'clipsContent')).toBe(true)
    // The gap is bound, so the sync resolves it again instead of freezing it.
    expect(hasInstanceOverride(graph, plain.id, 'itemSpacing')).toBe(false)

    graph.syncInstances('Card')

    expect(plain.clipsContent).toBe(true)
    expect(overridden.clipsContent).toBe(true)
    expect(plain.itemSpacing).toBe(16)
    expect(getNodeOrThrow(graph, 'Card').clipsContent).toBe(false)
    expect(getNodeOrThrow(graph, 'RowCard').clipsContent).toBe(false)
  })
})
