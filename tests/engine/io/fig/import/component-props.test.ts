import { describe, expect, test } from 'bun:test'

import type { NodeChange } from '#core/kiwi/fig/codec'
import { importNodeChanges } from '#core/kiwi/fig/import'

const documentGuid = { sessionID: 0, localID: 0 }
const pageGuid = { sessionID: 0, localID: 1 }
const componentGuid = { sessionID: 1, localID: 1 }
const componentTextGuid = { sessionID: 1, localID: 2 }
const instanceGuid = { sessionID: 2, localID: 1 }
const textPropGuid = { sessionID: 3, localID: 1 }
const iconPropGuid = { sessionID: 3, localID: 2 }
const mailIconGuid = { sessionID: 4, localID: 1 }
const mailVectorGuid = { sessionID: 4, localID: 2 }
const userIconGuid = { sessionID: 4, localID: 3 }
const userVectorGuid = { sessionID: 4, localID: 4 }
const componentIconGuid = { sessionID: 1, localID: 3 }
const sourceInstanceGuid = { sessionID: 2, localID: 2 }
const cloneInstanceGuid = { sessionID: 2, localID: 3 }
const strokeStyleGuid = { sessionID: 5, localID: 1 }

function baseTextChange(): NodeChange {
  return {
    guid: componentTextGuid,
    phase: 'CREATED',
    parentIndex: { guid: componentGuid, position: '!' },
    type: 'TEXT',
    name: 'Label',
    size: { x: 100, y: 20 },
    transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
    fontSize: 14,
    fontName: { family: 'Inter', style: 'Regular', postscript: '' },
    textData: { characters: 'Menu Item', lines: [{ lineType: 'PLAIN' }] },
    componentPropRefs: [{ defID: textPropGuid, componentPropNodeField: 'TEXT_DATA' }]
  }
}

describe('Figma component property import', () => {
  test('applies text data component prop assignments', () => {
    const nodeChanges: NodeChange[] = [
      { guid: documentGuid, phase: 'CREATED', type: 'DOCUMENT', name: 'Document' },
      {
        guid: pageGuid,
        phase: 'CREATED',
        parentIndex: { guid: documentGuid, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: componentGuid,
        phase: 'CREATED',
        parentIndex: { guid: pageGuid, position: '!' },
        type: 'SYMBOL',
        name: 'Menu item',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        componentPropDefs: [
          { id: textPropGuid, name: 'label', initialValue: { textValue: 'Menu Item' } }
        ]
      },
      baseTextChange(),
      {
        guid: instanceGuid,
        phase: 'CREATED',
        parentIndex: { guid: pageGuid, position: '"' },
        type: 'INSTANCE',
        name: 'Menu item instance',
        symbolData: { symbolID: componentGuid },
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 40 },
        componentPropAssignments: [
          {
            defID: textPropGuid,
            value: { textValue: { characters: 'Profile Item' } },
            varValue: { value: { textDataValue: { characters: 'Profile Item' } } }
          }
        ]
      }
    ]

    const graph = importNodeChanges(nodeChanges, [], undefined, { populate: 'all' })
    const labels = Array.from(graph.getAllNodes()).filter((node) => node.type === 'TEXT')
    expect(labels.map((node) => node.text).sort()).toEqual(['Menu Item', 'Profile Item'])
  })

  test('propagates nested instance swaps through clone chains', () => {
    const nodeChanges: NodeChange[] = [
      { guid: documentGuid, phase: 'CREATED', type: 'DOCUMENT', name: 'Document' },
      {
        guid: pageGuid,
        phase: 'CREATED',
        parentIndex: { guid: documentGuid, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: strokeStyleGuid,
        phase: 'CREATED',
        parentIndex: { guid: pageGuid, position: '&' },
        type: 'ROUNDED_RECTANGLE',
        name: 'slate/700',
        styleType: 'FILL',
        fillPaints: [
          {
            type: 'SOLID',
            color: { r: 0.2, g: 0.25, b: 0.33, a: 1 },
            opacity: 1,
            visible: true,
            blendMode: 'NORMAL'
          }
        ]
      },
      {
        guid: mailIconGuid,
        phase: 'CREATED',
        parentIndex: { guid: pageGuid, position: '!' },
        type: 'SYMBOL',
        name: 'icon/mail',
        size: { x: 16, y: 16 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: mailVectorGuid,
        phase: 'CREATED',
        parentIndex: { guid: mailIconGuid, position: '!' },
        type: 'VECTOR',
        name: 'mail-path',
        size: { x: 16, y: 16 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        strokePaints: [
          {
            type: 'SOLID',
            color: { r: 0, g: 0, b: 0, a: 1 },
            opacity: 1,
            visible: true,
            blendMode: 'NORMAL'
          }
        ],
        strokeWeight: 2,
        strokeAlign: 'CENTER'
      },
      {
        guid: userIconGuid,
        phase: 'CREATED',
        parentIndex: { guid: pageGuid, position: '"' },
        type: 'SYMBOL',
        name: 'icon/user',
        size: { x: 16, y: 16 },
        transform: { m00: 1, m01: 0, m02: 40, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: userVectorGuid,
        phase: 'CREATED',
        parentIndex: { guid: userIconGuid, position: '!' },
        type: 'VECTOR',
        name: 'user-path',
        size: { x: 16, y: 16 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        strokePaints: [
          {
            type: 'SOLID',
            color: { r: 0, g: 0, b: 0, a: 1 },
            opacity: 1,
            visible: true,
            blendMode: 'NORMAL'
          }
        ],
        strokeWeight: 2,
        strokeAlign: 'CENTER'
      },
      {
        guid: componentGuid,
        phase: 'CREATED',
        parentIndex: { guid: pageGuid, position: '#' },
        type: 'SYMBOL',
        name: 'Menu item',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 80, m10: 0, m11: 1, m12: 0 },
        componentPropDefs: [
          { id: iconPropGuid, name: 'icon', initialValue: { guidValue: mailIconGuid } }
        ]
      },
      {
        guid: componentIconGuid,
        phase: 'CREATED',
        parentIndex: { guid: componentGuid, position: '!' },
        type: 'INSTANCE',
        name: 'icon/mail',
        symbolData: { symbolID: mailIconGuid },
        size: { x: 16, y: 16 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        componentPropRefs: [{ defID: iconPropGuid, componentPropNodeField: 'OVERRIDDEN_SYMBOL_ID' }]
      },
      {
        guid: sourceInstanceGuid,
        phase: 'CREATED',
        parentIndex: { guid: pageGuid, position: '$' },
        type: 'INSTANCE',
        name: 'Menu item source',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 120, m10: 0, m11: 1, m12: 0 },
        componentPropAssignments: [
          {
            defID: iconPropGuid,
            value: { guidValue: userIconGuid },
            varValue: { value: { symbolIdValue: { guid: userIconGuid } } }
          }
        ],
        symbolData: {
          symbolID: componentGuid,
          symbolOverrides: [
            {
              guidPath: { guids: [componentIconGuid, mailVectorGuid] },
              styleIdForStrokeFill: { guid: strokeStyleGuid }
            }
          ]
        }
      },
      {
        guid: cloneInstanceGuid,
        phase: 'CREATED',
        parentIndex: { guid: pageGuid, position: '%' },
        type: 'INSTANCE',
        name: 'Menu item clone',
        symbolData: { symbolID: sourceInstanceGuid },
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 160, m10: 0, m11: 1, m12: 0 }
      }
    ]

    const graph = importNodeChanges(nodeChanges, [], undefined, { populate: 'all' })
    const clone = Array.from(graph.getAllNodes()).find((node) => node.name === 'Menu item clone')
    const icon = clone?.childIds
      .map((id) => graph.getNode(id))
      .find((node) => node?.type === 'INSTANCE')
    const iconChild = icon?.childIds.map((id) => graph.getNode(id)).find(Boolean)
    expect(icon?.name).toBe('icon/user')
    expect(iconChild?.name).toBe('user-path')
    expect(iconChild?.strokes[0]?.color).toEqual({ r: 0.2, g: 0.25, b: 0.33, a: 1 })
  })
})
