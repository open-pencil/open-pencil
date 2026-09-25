import { describe, expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { canvas, doc, node } from './helpers'

const paint = {
  type: 'SOLID' as const,
  color: { r: 0.2, g: 0.4, b: 0.9, a: 1 },
  opacity: 1,
  visible: true,
  blendMode: 'NORMAL' as const
}

const effect = {
  type: 'DROP_SHADOW' as const,
  color: { r: 0, g: 0, b: 0, a: 0.25 },
  offset: { x: 0, y: 4 },
  radius: 8,
  spread: 0,
  visible: true
}

const grid = { pattern: 'COLUMNS', count: 12, gutterSize: 16, visible: true }

describe('fig-import: shared styles', () => {
  test('models all style references and keeps definitions internal', () => {
    const graph = materializeDocument([
      doc(),
      canvas(),
      node('ROUNDED_RECTANGLE', 20, 1, {
        name: 'Brand/Fill',
        styleType: 'FILL',
        fillPaints: [paint]
      } as Partial<NodeChange>),
      node('TEXT', 21, 1, {
        name: 'Type/Body',
        styleType: 'TEXT',
        fontSize: 18,
        fontName: { family: 'Inter', style: 'Bold' },
        lineHeight: { value: 26, units: 'PIXELS' }
      } as Partial<NodeChange>),
      node('ROUNDED_RECTANGLE', 22, 1, {
        name: 'Effects/Card',
        styleType: 'EFFECT',
        effects: [effect]
      } as Partial<NodeChange>),
      node('FRAME', 23, 1, {
        name: 'Grid/12 columns',
        styleType: 'GRID',
        layoutGrids: [grid]
      } as Partial<NodeChange>),
      node('FRAME', 10, 1, {
        name: 'Styled target',
        styleIdForFill: { guid: { sessionID: 1, localID: 20 } },
        styleIdForStrokeFill: { guid: { sessionID: 1, localID: 20 } },
        styleIdForText: { guid: { sessionID: 1, localID: 21 } },
        styleIdForEffect: { guid: { sessionID: 1, localID: 22 } },
        styleIdForGrid: { guid: { sessionID: 1, localID: 23 } }
      } as Partial<NodeChange>)
    ]).graph

    const target = [...graph.getAllNodes()].find((item) => item.name === 'Styled target')
    const styleId = (name: string) =>
      [...graph.getAllNodes()].find((node) => node.name === name)?.id
    expect(target).toMatchObject({
      fillStyleId: styleId('Brand/Fill'),
      strokeStyleId: styleId('Brand/Fill'),
      textStyleId: styleId('Type/Body'),
      effectStyleId: styleId('Effects/Card'),
      gridStyleId: styleId('Grid/12 columns'),
      fontSize: 18,
      fontWeight: 700,
      lineHeight: 26,
      fills: [paint],
      effects: [effect],
      layoutGrids: [grid]
    })
    const definitions = [...graph.getAllNodes()].filter((item) => item.sharedStyleType)
    expect(definitions).toHaveLength(4)
    expect(definitions.every((item) => item.internalOnly)).toBe(true)
  })
})
