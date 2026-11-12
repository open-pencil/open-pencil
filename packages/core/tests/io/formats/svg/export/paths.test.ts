import { describe, expect, test } from 'bun:test'

import { geometryBlobToSVGPath } from '@open-pencil/core/io/formats/svg'

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
