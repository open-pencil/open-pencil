import { describe, expect, test } from 'bun:test'

import {
  resolveGeometryPaths,
  styleOverrideFillsById
} from '../../../packages/core/src/kiwi/fig/node-change/vector-geometry'

describe('vector fillGeometry style overrides', () => {
  test('maps styleOverrideTable fillPaints by styleID', () => {
    const map = styleOverrideFillsById([
      {
        styleID: 1,
        fillPaints: [
          {
            type: 'SOLID',
            color: { r: 1, g: 0.32, b: 0, a: 1 },
            opacity: 1,
            visible: true,
            blendMode: 'NORMAL'
          }
        ]
      },
      {
        styleID: 2,
        handleMirroring: 'NONE'
        // no fillPaints — ignored
      }
    ])

    expect(map.has(1)).toBe(true)
    expect(map.has(2)).toBe(false)
    const orange = map.get(1)?.[0]?.color
    expect(orange).toBeDefined()
    expect(orange!.r).toBeCloseTo(1, 2)
    expect(orange!.g).toBeCloseTo(0.32, 2)
    expect(orange!.b).toBeCloseTo(0, 2)
  })

  test('resolveGeometryPaths attaches override fills for non-zero styleID', () => {
    const blobA = new Uint8Array([1, 2, 3])
    const blobB = new Uint8Array([4, 5, 6])
    const blobC = new Uint8Array([7, 8, 9])
    const styleFills = styleOverrideFillsById([
      {
        styleID: 1,
        fillPaints: [
          {
            type: 'SOLID',
            color: { r: 1, g: 0.32, b: 0, a: 1 },
            opacity: 1,
            visible: true,
            blendMode: 'NORMAL'
          }
        ]
      }
    ])

    // Mirrors FedEx fillGeometry style pattern: orange, orange, default (style 0).
    const paths = resolveGeometryPaths(
      [
        { windingRule: 'NONZERO', commandsBlob: 0, styleID: 1 },
        { windingRule: 'NONZERO', commandsBlob: 1, styleID: 1 },
        { windingRule: 'NONZERO', commandsBlob: 2, styleID: 0 }
      ],
      [blobA, blobB, blobC],
      styleFills
    )

    expect(paths).toHaveLength(3)
    expect(paths[0]?.styleID).toBe(1)
    expect(paths[0]?.fills?.[0]?.color.r).toBeCloseTo(1, 2)
    expect(paths[1]?.styleID).toBe(1)
    expect(paths[1]?.fills?.[0]?.color.g).toBeCloseTo(0.32, 2)
    // style 0 → use node fills at paint time (no path-level fills)
    expect(paths[2]?.styleID).toBeUndefined()
    expect(paths[2]?.fills).toBeUndefined()
  })
})
