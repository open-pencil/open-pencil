import { expect, test } from 'bun:test'

import { interpretInstance } from '#fig/instance-overrides/interpret'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guid } from '@open-pencil/test-support/fig/guid'

const STYLE_SIZE = 28
const STALE_SOURCE_SIZE = 16
const CLAIM_SIZE = 20

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
      symbolOverrides: [{ guidPath: { guids: [guid(3)] }, fontSize: CLAIM_SIZE }]
    }
  } as NodeChange
]

test('raw records draw the inherited style over a claim and a stale source value', () => {
  expect(interpretInstance(changes, '1:4').children[0].properties.fontSize).toBe(STYLE_SIZE)
})

test('raw records keep the claim when the inherited style was removed', () => {
  const removedStyle = changes.map((change) =>
    change.styleType === 'TEXT' ? { ...change, phase: 'REMOVED' as const } : change
  )
  expect(interpretInstance(removedStyle, '1:4').children[0].properties.fontSize).toBe(CLAIM_SIZE)
})

test('a library style key resolves to the active style, not a removed one with that key', () => {
  const ACTIVE_STYLE_SIZE = 24
  const libraryStyle = { assetRef: { key: 'heading', version: '' } }
  const keyedRecords = changes.map((change) => {
    if (change.styleType === 'TEXT') {
      return { ...change, key: 'heading', fontSize: ACTIVE_STYLE_SIZE }
    }
    if (change.type === 'TEXT') {
      return { ...change, styleIdForText: libraryStyle }
    }
    return change
  })
  const removedDuplicate: NodeChange = {
    guid: guid(5),
    type: 'TEXT',
    styleType: 'TEXT',
    key: 'heading',
    fontSize: STYLE_SIZE,
    phase: 'REMOVED'
  }
  expect(
    interpretInstance([...keyedRecords, removedDuplicate], '1:4').children[0].properties.fontSize
  ).toBe(ACTIVE_STYLE_SIZE)
})

test('raw records leave a removed child out of the instance, as the reader does', () => {
  const removedChild: NodeChange = {
    guid: guid(6),
    type: 'TEXT',
    parentIndex: { guid: guid(2), position: '"' },
    textData: { characters: 'Gone' },
    phase: 'REMOVED'
  }
  expect(interpretInstance([...changes, removedChild], '1:4').children).toHaveLength(1)
})
