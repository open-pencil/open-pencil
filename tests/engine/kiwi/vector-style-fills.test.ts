import { beforeAll, describe, expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'

import {
  resolveGeometryPaths,
  styleOverrideFillsById
} from '#core/kiwi/fig/node-change/vector-geometry'

import { expectDefined } from '#tests/helpers/assert'

const ORANGE = {
  type: 'SOLID' as const,
  color: { r: 1, g: 0.32, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  blendMode: 'NORMAL' as const
}

const PURPLE = {
  type: 'SOLID' as const,
  color: { r: 0.3, g: 0.06, b: 0.52, a: 1 },
  opacity: 1,
  visible: true,
  blendMode: 'NORMAL' as const
}

function rectangleCommandsBlob(x: number, y: number, width: number, height: number): Uint8Array {
  const blob = new Uint8Array(1 + 4 * 9 + 1)
  const view = new DataView(blob.buffer)
  const points = [
    { command: 1, x, y },
    { command: 2, x: x + width, y },
    { command: 2, x: x + width, y: y + height },
    { command: 2, x, y: y + height }
  ]
  let offset = 0
  for (const point of points) {
    blob[offset] = point.command
    view.setFloat32(offset + 1, point.x, true)
    view.setFloat32(offset + 5, point.y, true)
    offset += 9
  }
  blob[offset] = 0
  return blob
}

describe('vector fillGeometry style overrides', () => {
  test('maps styleOverrideTable fillPaints by styleID', () => {
    const map = styleOverrideFillsById([
      { styleID: 1, fillPaints: [ORANGE] },
      {
        styleID: 2,
        handleMirroring: 'NONE'
        // no fillPaints — ignored
      }
    ])

    expect(map.has(1)).toBe(true)
    expect(map.has(2)).toBe(false)
    const orange = expectDefined(map.get(1)?.[0]?.color, 'style 1 fill color')
    expect(orange.r).toBeCloseTo(1, 2)
    expect(orange.g).toBeCloseTo(0.32, 2)
    expect(orange.b).toBeCloseTo(0, 2)
  })

  test('resolveGeometryPaths attaches override fills for non-zero styleID', () => {
    const blobA = new Uint8Array([1, 2, 3])
    const blobB = new Uint8Array([4, 5, 6])
    const blobC = new Uint8Array([7, 8, 9])
    const styleFills = styleOverrideFillsById([{ styleID: 1, fillPaints: [ORANGE] }])

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

  describe('export → import roundtrip', () => {
    beforeAll(async () => {
      await initCodec()
    })

    test('per-path fill overrides survive serialization', async () => {
      const graph = new SceneGraph()
      const page = graph.getPages()[0]
      graph.createNode('VECTOR', page.id, {
        name: 'Wordmark',
        width: 100,
        height: 40,
        fills: [PURPLE],
        vectorNetwork: {
          vertices: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 40 }
          ],
          segments: [
            { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
            { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
          ],
          regions: []
        },
        fillGeometry: [
          // Imported styleID (e.g. FedEx "Ex" orange) — must survive re-export.
          {
            windingRule: 'NONZERO',
            commandsBlob: rectangleCommandsBlob(50, 0, 50, 40),
            styleID: 5,
            fills: [ORANGE]
          },
          // Default path → node fills (purple).
          { windingRule: 'NONZERO', commandsBlob: rectangleCommandsBlob(0, 0, 50, 40) }
        ]
      })

      const reimported = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
      const wordmark = expectDefined(
        [...reimported.getAllNodes()].find((node) => node.name === 'Wordmark'),
        'reimported wordmark'
      )

      expect(wordmark.fillGeometry).toHaveLength(2)
      const orangePath = expectDefined(wordmark.fillGeometry[0], 'orange path')
      expect(orangePath.styleID).toBeGreaterThan(0)
      const orange = expectDefined(orangePath.fills?.[0]?.color, 'orange path fill color')
      expect(orange.r).toBeCloseTo(1, 2)
      expect(orange.g).toBeCloseTo(0.32, 2)
      expect(orange.b).toBeCloseTo(0, 2)

      // Default path keeps using node fills — no path-level override.
      expect(wordmark.fillGeometry[1]?.fills).toBeUndefined()
      expect(wordmark.fills[0]?.color.r).toBeCloseTo(0.3, 2)
    })
  })
})
