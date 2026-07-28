import { describe, expect, test } from 'bun:test'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import {
  applyStyleRefsToFields,
  buildStyleOverrideTable,
  convertEffects,
  convertFills,
  convertFontFeatures,
  convertLetterSpacing,
  convertLineHeight,
  convertStrokes,
  decodeVectorNetworkBlob,
  encodePathCommandsBlob,
  encodeVectorNetworkBlob,
  mapTextDecoration,
  nodeChangeToProps,
  setVariableColorResolver
} from '../src/node-change'

describe('@open-pencil/fig NodeChange policy', () => {
  test('converts normalized text values', () => {
    expect(convertLineHeight({ value: 120, units: 'PERCENT' }, 20)).toBe(24)
    expect(convertLetterSpacing({ value: 10, units: 'PERCENT' }, 20)).toBe(2)
    expect(mapTextDecoration('UNDERLINE')).toBe('UNDERLINE')
  })

  test('converts Figma OpenType feature toggles', () => {
    expect(
      convertFontFeatures({
        toggledOnOTFeatures: ['DLIG'],
        toggledOffOTFeatures: ['LIGA']
      })
    ).toEqual([
      { tag: 'DLIG', enabled: true },
      { tag: 'LIGA', enabled: false }
    ])
  })

  test('normalizes imported paints and effects', () => {
    expect(convertFills([{ type: 'SOLID' }])[0]).toMatchObject({
      color: { r: 0, g: 0, b: 0, a: 1 },
      opacity: 1,
      visible: true
    })
    expect(convertEffects([{ type: 'DROP_SHADOW' }])[0]).toMatchObject({
      type: 'DROP_SHADOW',
      radius: 0,
      visible: true
    })
  })

  test('keeps resolved variable alpha in paint opacity', () => {
    setVariableColorResolver(() => ({ r: 1, g: 0, b: 0, a: 0.4 }))
    try {
      const paint = {
        type: 'SOLID',
        color: { r: 0, g: 0, b: 0, a: 1 },
        colorVar: { value: { alias: { guid: { sessionID: 1, localID: 2 } } } }
      }
      expect(convertFills([paint])[0]).toMatchObject({
        color: { r: 1, g: 0, b: 0, a: 1 },
        opacity: 0.4
      })
      expect(convertStrokes([paint])[0]).toMatchObject({
        color: { r: 1, g: 0, b: 0, a: 1 },
        opacity: 0.4
      })
    } finally {
      setVariableColorResolver(null)
    }
  })

  test('uses vector-region winding rules for rendered geometry', () => {
    const network = {
      vertices: [
        { x: 0, y: 0, handleMirroring: 'NONE' as const },
        { x: 10, y: 0, handleMirroring: 'NONE' as const },
        { x: 0, y: 10, handleMirroring: 'NONE' as const }
      ],
      segments: [
        {
          start: 0,
          end: 1,
          tangentStart: { x: 0, y: 0 },
          tangentEnd: { x: 0, y: 0 }
        },
        {
          start: 1,
          end: 2,
          tangentStart: { x: 0, y: 0 },
          tangentEnd: { x: 0, y: 0 }
        },
        {
          start: 2,
          end: 0,
          tangentStart: { x: 0, y: 0 },
          tangentEnd: { x: 0, y: 0 }
        }
      ],
      regions: [{ windingRule: 'EVENODD' as const, loops: [[0, 1, 2]] }]
    }
    const props = nodeChangeToProps(
      {
        type: 'VECTOR',
        fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: 0 }],
        vectorData: { vectorNetworkBlob: 1 }
      } as NodeChange,
      [
        encodePathCommandsBlob([
          { type: 'M', x: 0, y: 0 },
          { type: 'L', x: 10, y: 0 },
          { type: 'L', x: 0, y: 10 },
          { type: 'Z' }
        ]),
        encodeVectorNetworkBlob(network)
      ]
    )

    expect(props.fillGeometry[0]?.windingRule).toBe('EVENODD')
  })

  test('round-trips vector network blobs with handle mirroring', () => {
    const network = {
      vertices: [
        { x: 0, y: 0, handleMirroring: 'ANGLE' as const },
        { x: 10, y: 0, handleMirroring: 'NONE' as const }
      ],
      segments: [
        {
          start: 0,
          end: 1,
          tangentStart: { x: 0, y: 0 },
          tangentEnd: { x: 0, y: 0 }
        }
      ],
      regions: []
    }
    const { table, mirroringToId } = buildStyleOverrideTable(network)
    expect(decodeVectorNetworkBlob(encodeVectorNetworkBlob(network, mirroringToId), table)).toEqual(
      network
    )
  })

  test('resolves imported style references before SceneGraph conversion', () => {
    const fields: Record<string, unknown> = {
      styleIdForFill: { guid: { sessionID: 2, localID: 3 } }
    }
    applyStyleRefsToFields(
      new Map([
        [
          '2:3',
          {
            type: 'RECTANGLE',
            styleType: 'FILL',
            fillPaints: [{ type: 'SOLID', visible: true }]
          }
        ]
      ]),
      fields
    )
    expect(fields.fillPaints).toEqual([{ type: 'SOLID', visible: true }])
  })
})
