import { expect, test } from 'bun:test'

import { hasInstanceOverride } from '@open-pencil/scene-graph/instances'
import { expectDefined, getNodeOrThrow } from '@open-pencil/test-support/assert'

import { parseDocument } from './helpers/document'

// A theme re-read changes the clip before an override snapshots the copy, so the change has to
// be recorded then: a sync otherwise puts the component's clip back (#2170).
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
      themes: { semantic: ['light', 'dark'] },
      variables: {
        clip: {
          type: 'boolean',
          value: [
            { value: false, theme: { semantic: 'light' } },
            { value: true, theme: { semantic: 'dark' } }
          ]
        },
        space: {
          type: 'number',
          value: [
            { value: 4, theme: { semantic: 'light' } },
            { value: 16, theme: { semantic: 'dark' } }
          ]
        }
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
