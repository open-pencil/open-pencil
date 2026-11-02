import { expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import { patchedRecord } from '#fig/record-patch/fields'

import type { NodeChange } from '@lawha/kiwi/fig/codec'

const path = (...ids: number[]) => ({ guids: ids.map((id) => guid(id)) })

test("merges an instance's changed overrides by path, keeping the entries it did not change", () => {
  const instance = {
    guid: guid(1),
    type: 'INSTANCE',
    name: 'Lists',
    symbolData: {
      symbolID: guid(9),
      symbolOverrides: [
        { guidPath: path(2), size: { x: 10, y: 10 }, stackCounterSizing: 'FIXED' },
        { guidPath: path(3, 4), stackSpacing: 15 },
        { guidPath: path(5), visible: false }
      ]
    },
    derivedSymbolData: [{ guidPath: path(3), size: { x: 1, y: 1 } }]
  } as NodeChange

  const patched = patchedRecord(instance, {
    guid: guid(1),
    set: { name: 'Lists renamed' },
    unset: [],
    symbolOverrides: {
      entries: [
        { path: [guid(2)], set: { name: 'Lists renamed' }, unset: ['stackCounterSizing'] },
        { path: [guid(6)], set: { visible: false }, unset: [] }
      ],
      removed: [[guid(5)]]
    },
    derivedSymbolData: {
      entries: [{ path: [guid(3)], set: { size: { x: 2, y: 2 } }, unset: [] }],
      removed: []
    }
  })

  expect(patched).toEqual({
    ...instance,
    name: 'Lists renamed',
    symbolData: {
      symbolID: guid(9),
      symbolOverrides: [
        { guidPath: path(2), size: { x: 10, y: 10 }, name: 'Lists renamed' },
        { guidPath: path(3, 4), stackSpacing: 15 },
        { guidPath: path(6), visible: false }
      ]
    },
    derivedSymbolData: [{ guidPath: path(3), size: { x: 2, y: 2 } }]
  } as NodeChange)
})
