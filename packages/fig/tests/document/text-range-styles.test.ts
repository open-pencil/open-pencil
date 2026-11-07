import { describe, expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneNode } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { expectDefined } from '@open-pencil/test-support/assert'
import { guid } from '@open-pencil/test-support/fig/guid'

const MUTED_COLOR: Color = { r: 0.5, g: 0.5, b: 0.5, a: 1 }
const PRIMARY_COLOR: Color = { r: 0.2, g: 0.4, b: 0.9, a: 1 }

const solid = (color: Color): NonNullable<NodeChange['fillPaints']> => [
  { type: 'SOLID', color, opacity: 1, visible: true }
]
const MUTED = solid(MUTED_COLOR)
const OUTDATED_PRIMARY = solid({ r: 0.9, g: 0.2, b: 0.2, a: 1 })
const PRIMARY = solid(PRIMARY_COLOR)
const OWN = solid({ r: 0.1, g: 0.8, b: 0.3, a: 1 })
const PRIMARY_LIBRARY_REF = { assetRef: { key: 'primary', version: '2:0' } }
const HEADING_REF = { guid: guid(52) }
const LABEL = 'Total 42'
const LAST_TWO_CHARACTERS_STYLED = [0, 0, 0, 0, 0, 0, 1, 1]

const STYLES: NodeChange[] = [
  {
    guid: guid(51),
    type: 'RECTANGLE',
    styleType: 'FILL',
    key: 'primary',
    version: '2:0',
    fillPaints: PRIMARY
  },
  {
    guid: guid(50),
    type: 'RECTANGLE',
    styleType: 'FILL',
    key: 'primary',
    version: '1:0',
    fillPaints: OUTDATED_PRIMARY
  },
  {
    guid: guid(52),
    type: 'TEXT',
    styleType: 'TEXT',
    fontSize: 32,
    fontName: { family: 'Inter', style: 'Bold', postscript: 'Inter-Bold' }
  }
]

function importedTextWithRange(range: NodeChange): SceneNode {
  const { graph, sources } = materializeDocument([
    { guid: guid(0), type: 'DOCUMENT' },
    ...STYLES,
    { guid: guid(3), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
    {
      guid: guid(4),
      type: 'TEXT',
      parentIndex: { guid: guid(3), position: '!' },
      fontSize: 14,
      fillPaints: MUTED,
      textData: {
        characters: LABEL,
        characterStyleIDs: LAST_TWO_CHARACTERS_STYLED,
        styleOverrideTable: [{ styleID: 1, ...range }]
      }
    }
  ])
  return expectDefined(graph.getNode(expectDefined(sources.get('1:4'), 'text id')), 'text')
}

function styledRun(text: SceneNode) {
  return expectDefined(text.styleRuns[0], 'style run')
}

function runColor(text: SceneNode) {
  return expectDefined(styledRun(text).style.fills?.[0], 'run fill').color
}

describe('text ranges that name a fill style', () => {
  test('draw in the paints of the style version they name', () => {
    const text = importedTextWithRange({ styleIdForFill: PRIMARY_LIBRARY_REF })

    expect(styledRun(text)).toMatchObject({ start: 6, length: 2 })
    expect(runColor(text)).toEqual(PRIMARY_COLOR)
  })

  test('draw in them when an instance overrides the range', () => {
    const changes = [
      { guid: guid(0), type: 'DOCUMENT' },
      ...STYLES,
      { guid: guid(3), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
      {
        guid: guid(1),
        type: 'SYMBOL',
        parentIndex: { guid: guid(3), position: '!' },
        size: { x: 200, y: 40 }
      },
      {
        guid: guid(2),
        type: 'TEXT',
        parentIndex: { guid: guid(1), position: '!' },
        fillPaints: MUTED,
        textData: { characters: LABEL }
      },
      {
        guid: guid(4),
        type: 'INSTANCE',
        parentIndex: { guid: guid(3), position: '"' },
        symbolData: {
          symbolID: guid(1),
          symbolOverrides: [
            {
              guidPath: { guids: [guid(2)] },
              textData: {
                characters: LABEL,
                characterStyleIDs: LAST_TWO_CHARACTERS_STYLED,
                styleOverrideTable: [{ styleID: 1, styleIdForFill: PRIMARY_LIBRARY_REF }]
              }
            }
          ]
        }
      }
    ] as NodeChange[]
    const { graph, sources } = materializeDocument(changes)
    const instanceId = expectDefined(sources.get('1:4'), 'instance id')
    const text = expectDefined(graph.getChildren(instanceId)[0], 'instance text')

    expect(text.fills[0].color).toEqual(MUTED_COLOR)
    expect(runColor(text)).toEqual(PRIMARY_COLOR)
  })

  test('take the paints of the style over their own', () => {
    const text = importedTextWithRange({ styleIdForFill: PRIMARY_LIBRARY_REF, fillPaints: OWN })

    expect(runColor(text)).toEqual(PRIMARY_COLOR)
  })
})

describe('text ranges that name a text style', () => {
  test('keep their own fields, since ranges take only fill styles so far', () => {
    const text = importedTextWithRange({
      styleIdForText: HEADING_REF,
      textDecoration: 'UNDERLINE',
      fontSize: 20
    })

    expect(styledRun(text).style).toMatchObject({ textDecoration: 'UNDERLINE', fontSize: 20 })
  })
})
