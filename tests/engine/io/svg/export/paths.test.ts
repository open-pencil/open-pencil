import { describe, expect, test } from 'bun:test'

import { geometryBlobToSVGPath, vectorNetworkToSVGPaths } from '@open-pencil/core'

// --- geometryBlobToSVGPath tests ---

describe('geometryBlobToSVGPath()', () => {
  function makeBlobWithFloats(ops: Array<{ cmd: number; floats?: number[] }>): Uint8Array {
    let size = 0
    for (const op of ops) {
      size += 1 + (op.floats?.length ?? 0) * 4
    }
    const buf = new ArrayBuffer(size)
    const view = new DataView(buf)
    let o = 0
    for (const op of ops) {
      view.setUint8(o, op.cmd)
      o += 1
      if (op.floats) {
        for (const f of op.floats) {
          view.setFloat32(o, f, true)
          o += 4
        }
      }
    }
    return new Uint8Array(buf)
  }

  test('empty blob', () => {
    expect(geometryBlobToSVGPath(new Uint8Array(0))).toBe('')
  })

  test('move + line + close', () => {
    const blob = makeBlobWithFloats([
      { cmd: 1, floats: [10, 20] },
      { cmd: 2, floats: [30, 40] },
      { cmd: 0 }
    ])
    expect(geometryBlobToSVGPath(blob)).toBe('M10 20L30 40Z')
  })

  test('cubic bezier', () => {
    const blob = makeBlobWithFloats([
      { cmd: 1, floats: [0, 0] },
      { cmd: 4, floats: [10, 0, 20, 10, 30, 30] },
      { cmd: 0 }
    ])
    const result = geometryBlobToSVGPath(blob)
    expect(result).toContain('M0 0')
    expect(result).toContain('C10 0 20 10 30 30')
    expect(result).toContain('Z')
  })
})

// --- vectorNetworkToSVGPaths tests ---

describe('vectorNetworkToSVGPaths()', () => {
  test('single straight segment', () => {
    const paths = vectorNetworkToSVGPaths({
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 100 }
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
    })
    expect(paths).toHaveLength(1)
    expect(paths[0]).toContain('M0 0')
    expect(paths[0]).toContain('L100 100')
  })

  test('curved segment', () => {
    const paths = vectorNetworkToSVGPaths({
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      segments: [
        {
          start: 0,
          end: 1,
          tangentStart: { x: 0, y: 50 },
          tangentEnd: { x: 0, y: 50 }
        }
      ],
      regions: []
    })
    expect(paths).toHaveLength(1)
    expect(paths[0]).toContain('C')
  })

  test('region with loop', () => {
    const paths = vectorNetworkToSVGPaths({
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 2, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
    })
    expect(paths).toHaveLength(1)
    expect(paths[0]).toContain('M0 0')
    expect(paths[0]).toContain('Z')
  })

  test('empty network', () => {
    const paths = vectorNetworkToSVGPaths({ vertices: [], segments: [], regions: [] })
    expect(paths).toHaveLength(0)
  })
})
