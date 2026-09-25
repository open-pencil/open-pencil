import { expect, test } from 'bun:test'

import { interpretInstance } from '#fig/instance-overrides/interpret'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

const guid = (localID: number) => ({ sessionID: 1, localID })
for (const similarity of ['equal-values', 'equal-fields', 'matching-suffix'] as const) {
  test(`missing paths remain errors despite ${similarity}`, () => {
    const common =
      similarity === 'matching-suffix'
        ? { guidPath: { guids: [guid(99), guid(3)] }, opacity: 0.5 }
        : { guidPath: { guids: [guid(99)] }, opacity: 0.5 }
    const liveBySimilarity = {
      'equal-values': { guidPath: { guids: [guid(3)] }, opacity: 0.5 },
      'equal-fields': { guidPath: { guids: [guid(3)] }, opacity: 1 },
      'matching-suffix': { guidPath: { guids: [guid(3), guid(3)] }, opacity: 0.5 }
    }
    const live = liveBySimilarity[similarity]
    const records: NodeChange[] = [
      { guid: guid(1), type: 'SYMBOL' },
      { guid: guid(3), type: 'FRAME', parentIndex: { guid: guid(1), position: '!' } },
      {
        guid: guid(4),
        type: 'INSTANCE',
        symbolData: { symbolID: guid(1), symbolOverrides: [common, live] }
      }
    ]
    expect(() => interpretInstance(records, '1:4')).toThrow('Expected one instance-path target')
  })
}
