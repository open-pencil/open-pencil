import { describe, expect, test } from 'bun:test'

import { createDocumentReader } from '#fig/document/read'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guid } from '@open-pencil/test-support/fig/guid'

const paint = (opacity: number): NonNullable<NodeChange['fillPaints']> => [
  { type: 'SOLID', color: { r: 0.93, g: 0.9, b: 0.85, a: 1 }, opacity, visible: true }
]
const MUTED = paint(0.5)
const PRIMARY = paint(0.9)
// A library style comes as its local copy, named by key and version (`assetRef`).
const PRIMARY_REF = { assetRef: { key: 'primary', version: '2:0' } }
// "Total 42": "42" takes the Primary fill style.
const RANGE_IDS = [0, 0, 0, 0, 0, 0, 1, 1]
const RANGE_TABLE: NodeChange[] = [{ styleID: 1, styleIdForFill: PRIMARY_REF }]

const STYLES: NodeChange[] = [
  {
    guid: guid(50),
    type: 'RECTANGLE',
    styleType: 'FILL',
    key: 'primary',
    version: '1:0',
    fillPaints: MUTED
  },
  {
    guid: guid(51),
    type: 'RECTANGLE',
    styleType: 'FILL',
    key: 'primary',
    version: '2:0',
    fillPaints: PRIMARY
  }
]

function rangeFills(text: { properties: NodeChange }) {
  return text.properties.textData?.styleOverrideTable?.map((entry) => entry.fillPaints)
}

// Figma keeps only the style's reference in a range's table entry that an instance overrides,
// and draws the range in the style's paints (live-verified on a library fill style).
describe('text ranges that name a fill style', () => {
  test('take the paints of the style version they name', () => {
    const changes: NodeChange[] = [
      ...STYLES,
      { guid: guid(3), type: 'CANVAS' },
      {
        guid: guid(4),
        type: 'TEXT',
        parentIndex: { guid: guid(3), position: '!' },
        fillPaints: MUTED,
        textData: {
          characters: 'Total 42',
          characterStyleIDs: RANGE_IDS,
          styleOverrideTable: RANGE_TABLE
        }
      }
    ]
    const [text] = createDocumentReader(changes).readPage('1:3').children
    expect(rangeFills(text)).toEqual([PRIMARY])
  })

  test('take them when an instance overrides the range', () => {
    const changes: NodeChange[] = [
      ...STYLES,
      { guid: guid(1), type: 'SYMBOL', name: 'Badge' },
      {
        guid: guid(2),
        type: 'TEXT',
        parentIndex: { guid: guid(1), position: '!' },
        fillPaints: MUTED,
        textData: { characters: 'Total 42' }
      },
      { guid: guid(3), type: 'CANVAS' },
      {
        guid: guid(4),
        type: 'INSTANCE',
        parentIndex: { guid: guid(3), position: '!' },
        symbolData: {
          symbolID: guid(1),
          symbolOverrides: [
            {
              guidPath: { guids: [guid(2)] },
              textData: {
                characters: 'Total 42',
                characterStyleIDs: RANGE_IDS,
                styleOverrideTable: RANGE_TABLE
              }
            }
          ]
        }
      }
    ]
    const [instance] = createDocumentReader(changes).readPage('1:3').children
    const [text] = instance.children
    expect(text.properties.fillPaints).toEqual(MUTED)
    expect(rangeFills(text)).toEqual([PRIMARY])
  })
})
