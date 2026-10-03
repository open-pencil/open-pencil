import { describe, expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'
import type { DerivedSymbolOverride } from '@open-pencil/fig/instance-overrides'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { getNodeLocalMatrix } from '@open-pencil/scene-graph'

const guid = (localID: number) => ({ sessionID: 1, localID })
function derivedChild(
  source: Partial<NodeChange>,
  derived: DerivedSymbolOverride,
  clone = false,
  blobs: Uint8Array[] = []
) {
  const records: NodeChange[] = [
    { guid: guid(0), type: 'DOCUMENT' },
    { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
    { guid: guid(2), type: 'SYMBOL', parentIndex: { guid: guid(1), position: '!' } },
    {
      guid: guid(3),
      type: 'TEXT',
      size: { x: 100, y: 20 },
      transform: { m00: 1, m01: 0, m02: 8, m10: 0, m11: 1, m12: 8 },
      ...source,
      parentIndex: { guid: guid(2), position: '!' }
    },
    {
      guid: guid(4),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1), position: '"' },
      symbolData: { symbolID: guid(2) },
      derivedSymbolData: [{ ...derived, guidPath: { guids: [guid(3)] } }]
    }
  ]
  if (clone)
    records.push({
      guid: guid(5),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1), position: '#' },
      symbolData: { symbolID: guid(4) }
    })
  const { graph, sources } = materializeDocument(records, blobs, { derivedBounds: true })
  const root = sources.get(clone ? '1:5' : '1:4')
  if (!root) throw new Error('Missing instance')
  return graph.getChildren(root)[0]
}

describe('occurrence derived symbol data', () => {
  test('propagates saved glyphs through nested source instances', () => {
    const blob = new Uint8Array([0])
    const child = derivedChild(
      { textData: { characters: 'Account' } },
      {
        size: { x: 56, y: 20 },
        derivedTextData: {
          layoutSize: { x: 56, y: 20 },
          glyphs: [{ commandsBlob: 0, position: { x: 0, y: 10 }, fontSize: 14 }]
        }
      },
      true,
      [blob]
    )
    expect([child.width, child.height]).toEqual([56, 20])
    expect(child.derivedTextGlyphs?.[0]).toMatchObject({
      commandsBlob: blob,
      x: 0,
      y: 10,
      fontSize: 14
    })
  })

  test('size-only derived data retains the saved position', () => {
    const child = derivedChild({}, { size: { x: 184, y: 36 } })
    expect({ x: child.x, y: child.y, width: child.width, height: child.height }).toEqual({
      x: 8,
      y: 8,
      width: 184,
      height: 36
    })
  })

  test('explicit derived stretch dimensions win without inventing other axes', () => {
    const child = derivedChild(
      { size: { x: 256, y: 20 }, horizontalConstraint: 'STRETCH' },
      { size: { x: 232, y: 20 } }
    )
    expect([child.width, child.height]).toEqual([232, 20])
    const unchanged = derivedChild(
      { size: { x: 100, y: 20 }, horizontalConstraint: 'STRETCH', verticalConstraint: 'STRETCH' },
      {}
    )
    expect([unchanged.width, unchanged.height]).toEqual([100, 20])
  })

  test('complete reflected transform and size-only changes preserve the wire matrix', () => {
    const transform = { m00: 0, m01: -1, m02: 78, m10: -1, m11: 0, m12: 790 }
    for (const derived of [{ transform }, { size: { x: 762, y: 50 } }]) {
      const child = derivedChild({ type: 'VECTOR', size: { x: 24, y: 24 }, transform }, derived)
      const matrix = getNodeLocalMatrix(child)
      for (const [index, value] of [0, -1, 78, -1, 0, 790].entries())
        expect(matrix[index]).toBeCloseTo(value, 10)
    }
  })

  test('retains per-glyph placement and rotation from derived data', () => {
    const blob = new Uint8Array([0])
    const child = derivedChild(
      { textData: { characters: 'Menu Item' } },
      {
        derivedTextData: {
          layoutSize: { x: 64, y: 20 },
          glyphs: [
            {
              commandsBlob: 0,
              position: { x: 4, y: 15 },
              fontSize: 14,
              firstCharacter: 0,
              advance: 1,
              rotation: 0
            }
          ]
        }
      },
      false,
      [blob]
    )
    expect(child.derivedTextGlyphs).toEqual([
      { commandsBlob: blob, firstCharacter: 0, x: 4, y: 15, fontSize: 14, rotation: 0 }
    ])
  })
})
