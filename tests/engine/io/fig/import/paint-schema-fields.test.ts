import { describe, expect, test } from 'bun:test'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { nodeChangeToProps } from '#core/kiwi/fig/node-change/convert'

const sourceNodeId = { sessionID: 12, localID: 34 }
const customEffectId = { guid: { sessionID: 56, localID: 78 } }

describe('Figma paint schema field import', () => {
  test('imports pattern fill metadata for round-trip and fallback rendering', () => {
    const props = nodeChangeToProps(
      {
        type: 'RECTANGLE',
        fillPaints: [
          {
            type: 'PATTERN',
            color: { r: 0.2, g: 0.3, b: 0.4, a: 1 },
            opacity: 0.75,
            visible: true,
            sourceNodeId,
            scale: 1.5,
            spacing: 6,
            patternSpacing: { x: 8, y: 12 },
            patternTileType: 'HORIZONTAL_HEXAGONAL',
            verticalAlignment: 'CENTER',
            horizontalAlignment: 'END'
          }
        ]
      } as NodeChange,
      []
    )

    expect(props.fills?.[0]).toMatchObject({
      type: 'PATTERN',
      opacity: 0.75,
      sourceNodeId: '12:34',
      scale: 1.5,
      spacing: 6,
      patternSpacing: { x: 8, y: 12 },
      patternTileType: 'HORIZONTAL_HEXAGONAL',
      verticalAlignment: 'CENTER',
      horizontalAlignment: 'END'
    })
  })

  test('imports noise and custom fill metadata', () => {
    const props = nodeChangeToProps(
      {
        type: 'RECTANGLE',
        fillPaints: [
          {
            type: 'NOISE',
            color: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
            noiseType: 'DUOTONE',
            density: 0.42,
            noiseSize: { x: 16, y: 16 }
          },
          {
            type: 'CUSTOM',
            color: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
            customEffectId
          }
        ]
      } as NodeChange,
      []
    )

    expect(props.fills?.[0]).toMatchObject({
      type: 'NOISE',
      noiseType: 'DUOTONE',
      density: 0.42,
      noiseSize: { x: 16, y: 16 }
    })
    expect(props.fills?.[1]).toMatchObject({ type: 'CUSTOM', customEffectId: '56:78' })
  })
})
