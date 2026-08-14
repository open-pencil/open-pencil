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

  test('quadratic bezier', () => {
    const blob = makeBlobWithFloats([
      { cmd: 1, floats: [0, 0] },
      { cmd: 3, floats: [10, 0, 30, 30] },
      { cmd: 0 }
    ])
    const result = geometryBlobToSVGPath(blob)
    expect(result).toContain('M0 0')
    expect(result).toContain('Q10 0 30 30')
    expect(result).toContain('Z')
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

  test('traces arbitrarily ordered open segments as one path', () => {
    const paths = vectorNetworkToSVGPaths({
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 30, y: 0 }
      ],
      segments: [
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 2, end: 3, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: []
    })

    expect(paths).toEqual(['M0 0L10 0L20 0L30 0'])
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

  test('traces non-directional region segments continuously', () => {
    const paths = vectorNetworkToSVGPaths({
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 }
      ],
      segments: [
        { start: 1, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 0, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
    })

    expect(paths).toEqual(['M0 0L100 0L50 100L0 0Z'])
  })

  test('starts a new subpath for disconnected region segments', () => {
    const paths = vectorNetworkToSVGPaths({
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 30, y: 0 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 2, end: 3, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1]] }]
    })

    expect(paths).toEqual(['M0 0L10 0M20 0L30 0'])
  })

  test('recognizes closed unfilled segment chains', () => {
    const paths = vectorNetworkToSVGPaths({
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 2, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: []
    })

    expect(paths).toEqual(['M10 0L0 10L0 0L10 0Z'])
  })

  test('empty network', () => {
    const paths = vectorNetworkToSVGPaths({ vertices: [], segments: [], regions: [] })
    expect(paths).toHaveLength(0)
  })
})
