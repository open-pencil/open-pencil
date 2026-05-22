import { describe, expect, mock, test } from 'bun:test'

import { drawVectorPathStrokes, drawRegularStroke } from '#core/canvas/scene/stroke-draw'

import { createMockCanvas, createMockPaint } from './helpers'

/** Create a tracked Path class with its own allocation pool. */
function createTrackedPathClass(overrideStroke: 'fail' | 'succeed' = 'fail') {
  const allocations: Array<{ id: number; deleted: boolean }> = []
  let nextId = 1

  class TrackedPath {
    readonly id: number

    copy = () => new TrackedPath()

    stroke =
      overrideStroke === 'succeed'
        ? mock(function (this: TrackedPath) {
            return this
          })
        : mock(() => null)

    constructor() {
      this.id = nextId++
      allocations.push({ id: this.id, deleted: false })
    }

    delete() {
      const entry = allocations.find((a) => a.id === this.id)
      if (entry) entry.deleted = true
    }

    moveTo = mock(() => undefined)
    lineTo = mock(() => undefined)
    cubicTo = mock(() => undefined)
    close = mock(() => undefined)
    addPath = mock(() => undefined)
    addOval = mock(() => undefined)
    addRect = mock(() => undefined)
    addRRect = mock(() => undefined)
    op = mock(() => undefined)
  }

  return { TrackedPath, allocations }
}

function makeStroke(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    dashPattern: null,
    opacity: 1,
    weight: 1,
    cap: undefined,
    join: undefined,
    ...overrides
  }
}

const sc = { r: 0, g: 0, b: 0, a: 1 }

describe('drawVectorPathStrokes WASM resource lifecycle', () => {
  test('copy is deleted when stroke returns null (regression guard)', () => {
    const { TrackedPath, allocations } = createTrackedPathClass('fail')
    const r = {
      ck: {
        Color4f: (_r: number, _g: number, _b: number, _a: number) =>
          new Float32Array([_r, _g, _b, _a]),
        Path: TrackedPath,
        PathEffect: { MakeDash: () => ({ delete: mock(() => undefined) }) },
        StrokeCap: { Butt: 'butt', Round: 'round', Square: 'square' },
        StrokeJoin: { Bevel: 'bevel', Miter: 'miter', Round: 'round' }
      },
      strokePaint: createMockPaint({
        setColor: mock(() => undefined),
        setAlphaf: mock(() => undefined),
        setStrokeWidth: mock(() => undefined),
        setStrokeCap: mock(() => undefined),
        setStrokeJoin: mock(() => undefined),
        setShader: mock(() => undefined),
        setPathEffect: mock(() => undefined)
      }),
      fillPaint: createMockPaint({
        setColor: mock(() => undefined),
        setAlphaf: mock(() => undefined),
        setShader: mock(() => undefined)
      })
    }

    const canvas = createMockCanvas()
    const vp = new TrackedPath()
    const beforeCount = allocations.length

    drawVectorPathStrokes(r as never, canvas as never, [vp], makeStroke() as never, sc as never)

    expect(allocations.length - beforeCount).toBe(1)
    const lastEntry = allocations[allocations.length - 1]
    expect(lastEntry.deleted).toBe(true)
  })

  test('path copy is deleted when stroke succeeds (happy path)', () => {
    const { TrackedPath, allocations } = createTrackedPathClass('succeed')
    const r = {
      ck: {
        Color4f: () => new Float32Array(4),
        Path: TrackedPath,
        PathEffect: { MakeDash: () => ({ delete: mock(() => undefined) }) },
        StrokeCap: { Butt: 'butt', Round: 'round', Square: 'square' },
        StrokeJoin: { Bevel: 'bevel', Miter: 'miter', Round: 'round' }
      },
      strokePaint: createMockPaint({
        setColor: mock(() => undefined),
        setAlphaf: mock(() => undefined),
        setStrokeWidth: mock(() => undefined),
        setStrokeCap: mock(() => undefined),
        setStrokeJoin: mock(() => undefined),
        setShader: mock(() => undefined),
        setPathEffect: mock(() => undefined)
      }),
      fillPaint: createMockPaint({
        setColor: mock(() => undefined),
        setAlphaf: mock(() => undefined),
        setShader: mock(() => undefined)
      })
    }

    const canvas = createMockCanvas()
    const vp = new TrackedPath()
    const beforeCount = allocations.length

    drawVectorPathStrokes(r as never, canvas as never, [vp], makeStroke() as never, sc as never)

    expect(allocations.length - beforeCount).toBe(1)
    const copyEntry = allocations[allocations.length - 1]
    expect(copyEntry.deleted).toBe(true)
  })

  test('dashed stroke path does not leak (PathEffect lifecycle)', () => {
    const { TrackedPath, allocations } = createTrackedPathClass('succeed')
    const r = {
      ck: {
        Color4f: () => new Float32Array(4),
        Path: TrackedPath,
        PathEffect: { MakeDash: () => ({ delete: mock(() => undefined) }) },
        StrokeCap: { Butt: 'butt', Round: 'round', Square: 'square' },
        StrokeJoin: { Bevel: 'bevel', Miter: 'miter', Round: 'round' }
      },
      strokePaint: createMockPaint({
        setColor: mock(() => undefined),
        setAlphaf: mock(() => undefined),
        setStrokeWidth: mock(() => undefined),
        setStrokeCap: mock(() => undefined),
        setStrokeJoin: mock(() => undefined),
        setShader: mock(() => undefined),
        setPathEffect: mock(() => undefined)
      }),
      fillPaint: createMockPaint({
        setColor: mock(() => undefined),
        setAlphaf: mock(() => undefined),
        setShader: mock(() => undefined)
      })
    }

    const canvas = createMockCanvas()
    const vp = new TrackedPath()
    const beforeCount = allocations.length

    drawVectorPathStrokes(
      r as never,
      canvas as never,
      [vp],
      makeStroke({ dashPattern: [10, 5] }) as never,
      sc as never
    )

    expect(allocations.length - beforeCount).toBe(0)
  })
})

describe('drawVectorPathStrokes solid branch exception safety', () => {
  test('copy is deleted when canvas.drawPath throws', () => {
    // When drawPath throws in the non-dash (solid) branch, the copy
    // must still be deleted via try/finally — otherwise the WASM Path
    // leaks permanently.
    const { TrackedPath, allocations } = createTrackedPathClass('succeed')
    const r = {
      ck: {
        Color4f: () => new Float32Array(4),
        Path: TrackedPath,
        PathEffect: { MakeDash: () => ({ delete: mock(() => undefined) }) },
        StrokeCap: { Butt: 'butt', Round: 'round', Square: 'square' },
        StrokeJoin: { Bevel: 'bevel', Miter: 'miter', Round: 'round' }
      },
      strokePaint: createMockPaint({
        setColor: mock(() => undefined),
        setAlphaf: mock(() => undefined),
        setStrokeWidth: mock(() => undefined),
        setStrokeCap: mock(() => undefined),
        setStrokeJoin: mock(() => undefined),
        setShader: mock(() => undefined),
        setPathEffect: mock(() => undefined)
      }),
      fillPaint: createMockPaint({
        setColor: mock(() => undefined),
        setAlphaf: mock(() => undefined),
        setShader: mock(() => undefined)
      })
    }

    const canvas = createMockCanvas({
      drawPath: () => {
        throw new Error('CanvasKit drawPath error')
      }
    })

    const vp = new TrackedPath()
    const beforeCount = allocations.length

    expect(() => {
      drawVectorPathStrokes(r as never, canvas as never, [vp], makeStroke() as never, sc as never)
    }).toThrow('CanvasKit drawPath error')

    expect(allocations.length - beforeCount).toBe(1)
    const copyEntry = allocations[allocations.length - 1]
    expect(copyEntry.deleted).toBe(true)
  })
})

describe('drawRegularStroke PathEffect resource safety', () => {
  test('PathEffect is freed and strokePaint is reset when draw throws', () => {
    let pathEffectDeleted = false
    let lastSetPathEffect: unknown = null

    const mockPathEffect = {
      delete: () => {
        pathEffectDeleted = true
      }
    }

    const r = {
      ck: {
        Color4f: (_r: number, _g: number, _b: number, _a: number) =>
          new Float32Array([_r, _g, _b, _a]),
        PathEffect: { MakeDash: () => mockPathEffect }
      },
      strokePaint: {
        setColor: mock(() => undefined),
        setStrokeWidth: mock(() => undefined),
        setAlphaf: mock(() => undefined),
        setStrokeCap: mock(() => undefined),
        setStrokeJoin: mock(() => undefined),
        setPathEffect: (e: unknown) => {
          lastSetPathEffect = e
        }
      },
      isRectangularType: () => true,
      drawIndividualSideStrokes: () => {
        throw new Error('CanvasKit draw error')
      },
      drawStrokeWithAlign: () => {
        throw new Error('CanvasKit draw error')
      }
    } as never

    const node = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      independentStrokeWeights: true
    } as never

    const rect = new Float32Array([0, 0, 100, 100])
    const canvas = createMockCanvas()
    const stroke = { dashPattern: [10, 5], weight: 1, opacity: 1, align: 'CENTER' } as never

    expect(() => {
      drawRegularStroke(r, canvas as never, node, rect, false, stroke, sc)
    }).toThrow('CanvasKit draw error')

    expect(pathEffectDeleted).toBe(true)
    expect(lastSetPathEffect).toBeNull()
  })

  test('PathEffect is freed even when setPathEffect(null) throws (nested finally)', () => {
    let pathEffectDeleted = false

    const mockPathEffect = {
      delete: () => {
        pathEffectDeleted = true
      }
    }

    const r = {
      ck: {
        Color4f: (_r: number, _g: number, _b: number, _a: number) =>
          new Float32Array([_r, _g, _b, _a]),
        PathEffect: { MakeDash: () => mockPathEffect }
      },
      strokePaint: {
        setColor: mock(() => undefined),
        setStrokeWidth: mock(() => undefined),
        setAlphaf: mock(() => undefined),
        setStrokeCap: mock(() => undefined),
        setStrokeJoin: mock(() => undefined),
        setPathEffect: (e: unknown) => {
          // First call (with effect) succeeds, second call (null) throws
          if (e === null) throw new Error('setPathEffect(null) crash')
        }
      },
      isRectangularType: () => true,
      drawIndividualSideStrokes: () => undefined,
      drawStrokeWithAlign: () => undefined
    } as never

    const node = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      independentStrokeWeights: true
    } as never

    const rect = new Float32Array([0, 0, 100, 100])
    const canvas = createMockCanvas()
    const stroke = { dashPattern: [10, 5], weight: 1, opacity: 1, align: 'CENTER' } as never

    expect(() => {
      drawRegularStroke(r, canvas as never, node, rect, false, stroke, sc)
    }).toThrow('setPathEffect(null) crash')

    // THE critical invariant: PathEffect.delete() MUST have been called
    // even though setPathEffect(null) threw
    expect(pathEffectDeleted).toBe(true)
  })
})
