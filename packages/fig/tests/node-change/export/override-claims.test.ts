import { describe, expect, test } from 'bun:test'

import type { KiwiSymbolOverridePayload } from '#fig/node-change/export/context'
import { mergeOverrides } from '#fig/node-change/export/override-claims'

const at = (...ids: number[]) => ({ guids: ids.map((localID) => ({ sessionID: 1, localID })) })

describe('merging symbol overrides', () => {
  test('an override at a path already claimed merges into the last claim at that path', () => {
    const overrides: KiwiSymbolOverridePayload[] = [
      { guidPath: at(1), name: 'first' },
      { guidPath: at(2), visible: false },
      { guidPath: at(1), opacity: 0.5 }
    ]

    mergeOverrides(overrides, [{ guidPath: at(1), name: 'renamed' }])

    expect(overrides).toEqual([
      { guidPath: at(1), name: 'first' },
      { guidPath: at(2), visible: false },
      { guidPath: at(1), opacity: 0.5, name: 'renamed' }
    ])
  })

  test('new paths are added, and two new overrides at one path become one', () => {
    const overrides: KiwiSymbolOverridePayload[] = [{ guidPath: at(1), name: 'kept' }]

    mergeOverrides(overrides, [
      { guidPath: at(3, 4), visible: false },
      { guidPath: at(3, 4), opacity: 0.25 },
      { name: 'no path' },
      { name: 'no path either' }
    ])

    expect(overrides).toEqual([
      { guidPath: at(1), name: 'kept' },
      { guidPath: at(3, 4), visible: false, opacity: 0.25 },
      { name: 'no path' },
      { name: 'no path either' }
    ])
  })
})

describe('merging variable mode claims', () => {
  const sizes = { guid: { sessionID: 1, localID: 3 } }
  const theme = { guid: { sessionID: 1, localID: 8 } }
  const wide = { sessionID: 1, localID: 11 }

  test('two claims at one path keep the collections each of them claims', () => {
    const overrides: KiwiSymbolOverridePayload[] = [
      { guidPath: at(1), variableModeBySetMap: { entries: [{ variableSetID: theme }] } }
    ]

    mergeOverrides(overrides, [
      {
        guidPath: at(1),
        variableModeBySetMap: { entries: [{ variableSetID: sizes, variableModeID: wide }] }
      }
    ])

    expect(overrides).toEqual([
      {
        guidPath: at(1),
        variableModeBySetMap: {
          entries: [{ variableSetID: theme }, { variableSetID: sizes, variableModeID: wide }]
        }
      }
    ])
  })
})
