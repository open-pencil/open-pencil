import { expect, test } from 'bun:test'

import { interpretInstance } from '#fig/instance-overrides/interpret'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

const component = { sessionID: 1, localID: 1 }
const label = { sessionID: 1, localID: 2 }
const icon = { sessionID: 1, localID: 3 }
const placed = { sessionID: 2, localID: 1 }

/**
 * Reading a large design kit page and the components it places can outlast the population
 * worker's stall window by itself, so the read reports progress as it goes, not only once done.
 */
test('interpreting an instance reports progress for every layer it expands', () => {
  const changes = [
    { guid: component, type: 'SYMBOL' },
    { guid: label, type: 'TEXT', parentIndex: { guid: component, position: '!' } },
    { guid: icon, type: 'VECTOR', parentIndex: { guid: component, position: '"' } },
    { guid: placed, type: 'INSTANCE', symbolData: { symbolID: component } }
  ] as NodeChange[]
  let reports = 0
  const occurrence = interpretInstance(changes, '2:1', { onProgress: () => reports++ })

  expect(occurrence.children.map((child) => child.sourceId)).toEqual(['1:2', '1:3'])
  // The instance, the component it expands, and the component's two layers.
  expect(reports).toBe(4)
})
