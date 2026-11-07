import { expect, test } from 'bun:test'

import { interpretInstance } from '#fig/instance-overrides/interpret'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guid } from '@open-pencil/test-support/fig/guid'

const STYLE_SIZE = 28
const STALE_SOURCE_SIZE = 16

const changes: NodeChange[] = [
  { guid: guid(1), type: 'TEXT', styleType: 'TEXT', fontSize: STYLE_SIZE },
  { guid: guid(2), type: 'SYMBOL' },
  {
    guid: guid(3),
    type: 'TEXT',
    parentIndex: { guid: guid(2), position: '!' },
    textData: { characters: 'Label' },
    fontSize: STALE_SOURCE_SIZE,
    styleIdForText: { guid: guid(1) }
  },
  {
    guid: guid(4),
    type: 'INSTANCE',
    symbolData: {
      symbolID: guid(2),
      symbolOverrides: [{ guidPath: { guids: [guid(3)] }, fontSize: 20 }]
    }
  } as NodeChange
]

test('raw records draw the inherited style over a claim and a stale source value', () => {
  expect(interpretInstance(changes, '1:4').children[0].properties.fontSize).toBe(STYLE_SIZE)
})
