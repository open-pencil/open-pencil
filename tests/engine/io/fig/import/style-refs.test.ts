import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'
import { applyStyleRefsToFields } from '@open-pencil/fig/node-change'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

describe('fig import style refs', () => {
  test('resolves library paint styles referenced by asset key and version', () => {
    const fallbackPaint = {
      type: 'SOLID' as const,
      color: { r: 0.2, g: 0.4, b: 0.9, a: 1 },
      opacity: 1,
      visible: true,
      blendMode: 'NORMAL' as const
    }
    const versionedPaint = {
      type: 'SOLID' as const,
      color: { r: 0.96, g: 0.82, b: 1, a: 1 },
      opacity: 1,
      visible: true,
      blendMode: 'NORMAL' as const
    }
    const parentIndex = { guid: { sessionID: 0, localID: 1 }, position: '!' }
    const graph = importNodeChanges([
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', phase: 'CREATED' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        phase: 'CREATED'
      },
      {
        guid: { sessionID: 1, localID: 700 },
        parentIndex,
        type: 'RECTANGLE',
        name: 'Fallback style',
        styleType: 'FILL',
        key: 'purple-light',
        fillPaints: [fallbackPaint]
      },
      {
        guid: { sessionID: 1, localID: 708 },
        parentIndex,
        type: 'RECTANGLE',
        name: 'Versioned style',
        styleType: 'FILL',
        key: 'purple-light',
        version: '109:20',
        fillPaints: [versionedPaint]
      },
      {
        guid: { sessionID: 2, localID: 1 },
        parentIndex,
        type: 'RECTANGLE',
        name: 'Versioned target',
        styleIdForFill: { assetRef: { key: 'purple-light', version: '109:20' } }
      },
      {
        guid: { sessionID: 2, localID: 2 },
        parentIndex,
        type: 'RECTANGLE',
        name: 'Fallback target',
        styleIdForFill: { assetRef: { key: 'purple-light' } }
      }
    ] as NodeChange[])

    const nodes = [...graph.getAllNodes()]
    expect(nodes.find((node) => node.name === 'Versioned target')?.fills).toEqual([versionedPaint])
    expect(nodes.find((node) => node.name === 'Fallback target')?.fills).toEqual([fallbackPaint])
  })

  test('effect and grid styles replace stale direct payloads', () => {
    const effectGuid = { sessionID: 4, localID: 5000 }
    const gridGuid = { sessionID: 4, localID: 5001 }
    const effect = {
      type: 'DROP_SHADOW' as const,
      color: { r: 0, g: 0, b: 0, a: 0.25 },
      offset: { x: 0, y: 4 },
      radius: 8,
      spread: 0,
      visible: true
    }
    const grid = { pattern: 'COLUMNS', count: 12, gutterSize: 16, visible: true }
    const fields: Record<string, unknown> = {
      styleIdForEffect: { guid: effectGuid },
      styleIdForGrid: { guid: gridGuid },
      effects: [],
      layoutGrids: []
    }

    applyStyleRefsToFields(
      new Map([
        ['4:5000', { styleType: 'EFFECT', effects: [effect] }],
        ['4:5001', { styleType: 'GRID', layoutGrids: [grid] }]
      ]),
      fields
    )

    expect(fields.effects).toEqual([effect])
    expect(fields.layoutGrids).toEqual([grid])
  })

  test('stroke fill style overrides stale direct stroke paint', () => {
    const styleGuid = { sessionID: 4, localID: 4594 }
    const stylePaint = {
      type: 'SOLID' as const,
      color: { r: 0.886274516582489, g: 0.9098039269447327, b: 0.9411764740943909, a: 1 },
      opacity: 1,
      visible: true,
      blendMode: 'NORMAL' as const
    }
    const fields: Record<string, unknown> &
      Pick<NodeChange, 'styleIdForStrokeFill' | 'strokePaints'> = {
      styleIdForStrokeFill: { guid: styleGuid },
      strokePaints: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL'
        }
      ]
    }

    applyStyleRefsToFields(
      new Map([
        [
          '4:4594',
          {
            styleType: 'FILL',
            fillPaints: [stylePaint]
          }
        ]
      ]),
      fields
    )

    expect(fields.strokePaints).toEqual([stylePaint])
  })
})
