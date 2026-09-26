import { expect, test } from 'bun:test'

import { createOccurrenceInterpreter } from '#fig/instance-overrides/interpret'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

const guid = (sessionID: number, localID: number) => ({ sessionID, localID })

test('detached-symbol lineage retires an obsolete property path only when the live property target is explicit', () => {
  const records: NodeChange[] = [
    { guid: guid(1, 1), type: 'SYMBOL' },
    {
      guid: guid(1, 2),
      type: 'FRAME',
      parentIndex: { guid: guid(1, 1), position: '!' },
      detachedSymbolId: { guid: guid(2, 1) }
    },
    {
      guid: guid(1, 3),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1, 2), position: '!' },
      componentPropRefs: [{ defID: guid(3, 1), componentPropNodeField: 'OVERRIDDEN_SYMBOL_ID' }],
      symbolData: { symbolID: guid(4, 1) }
    },
    { guid: guid(2, 1), type: 'SYMBOL' },
    {
      guid: guid(2, 2),
      type: 'INSTANCE',
      parentIndex: { guid: guid(2, 1), position: '!' },
      componentPropRefs: [{ defID: guid(3, 1), componentPropNodeField: 'OVERRIDDEN_SYMBOL_ID' }],
      symbolData: { symbolID: guid(4, 1) }
    },
    {
      guid: guid(5, 1),
      type: 'INSTANCE',
      symbolData: {
        symbolID: guid(1, 1),
        symbolOverrides: [
          {
            guidPath: { guids: [guid(9, 9)] },
            componentPropAssignments: [{ defID: guid(3, 1), value: { guidValue: guid(4, 2) } }]
          }
        ]
      }
    }
  ]
  expect(() => createOccurrenceInterpreter(records).instance('5:1')).toThrow(
    'Expected one instance-path target'
  )
})
