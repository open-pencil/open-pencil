import { expect, test } from 'bun:test'

import { interpretInstance } from '#fig/instance-overrides/interpret'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

const guid = (localID: number) => ({ sessionID: 1, localID })

test('uses explicit derived geometry with its bounds instead of the oversized source path', () => {
  const changes = [
    { guid: guid(1), type: 'SYMBOL' },
    {
      guid: guid(2),
      type: 'VECTOR',
      parentIndex: { guid: guid(1), position: '!' },
      size: { x: 2650, y: 44 },
      fillGeometry: [{ commandsBlob: 0, windingRule: 'NONZERO' }]
    },
    {
      guid: guid(3),
      type: 'INSTANCE',
      symbolData: { symbolID: guid(1) },
      derivedSymbolData: [
        {
          guidPath: { guids: [guid(2)] },
          size: { x: 375, y: 39 },
          fillGeometry: [{ commandsBlob: 1, windingRule: 'NONZERO' }]
        }
      ]
    }
  ] as NodeChange[]
  const before = structuredClone(changes)
  const node = interpretInstance(changes, '1:3', { derivedBounds: true }).children[0]
  expect(node.properties.size).toEqual({ x: 375, y: 39 })
  expect(node.properties.fillGeometry).toEqual([{ commandsBlob: 1, windingRule: 'NONZERO' }])
  expect(interpretInstance(changes, '1:3').children[0].properties.size).toEqual({ x: 2650, y: 44 })
  expect(changes).toEqual(before)
})
