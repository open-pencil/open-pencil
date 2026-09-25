import { expect, test } from 'bun:test'

import { interpretInstance } from '#fig/instance-overrides/interpret'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { guid } from '../helpers/guid'

// Live Figma swapComponent probe: untouched name follows replacement, custom name stays.
test('a nested swap adopts the replacement name when no instance name is supplied', () => {
  const changes = [
    { guid: guid(1), type: 'SYMBOL', name: 'Original' },
    { guid: guid(2), type: 'SYMBOL', name: 'Replacement' },
    { guid: guid(3), type: 'SYMBOL' },
    {
      guid: guid(4),
      type: 'INSTANCE',
      parentIndex: { guid: guid(3), position: '!' },
      symbolData: { symbolID: guid(1) }
    },
    {
      guid: guid(5),
      type: 'INSTANCE',
      symbolData: {
        symbolID: guid(3),
        symbolOverrides: [{ guidPath: { guids: [guid(4)] }, overriddenSymbolID: guid(2) }]
      }
    }
  ] as NodeChange[]
  expect(interpretInstance(changes, '1:5').children[0].properties.name).toBe('Replacement')
})
