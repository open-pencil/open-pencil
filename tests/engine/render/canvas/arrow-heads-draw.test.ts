import { describe, expect, mock, test } from 'bun:test'

import { drawArrowHeads } from '#core/canvas/strokes'

import { asCanvas, asRenderer } from './helpers'

const SQRT3 = Math.sqrt(3)

function createHarness() {
  const moveToCalls: Array<[number, number]> = []
  const lineToCalls: Array<[number, number]> = []
  const drawLineCalls: Array<[number, number, number, number]> = []
  let pathsBuilt = 0
  let closeCalls = 0
  const detached = { delete: mock(() => undefined) }

  class MockPathBuilder {
    constructor() {
      pathsBuilt++
    }

    moveTo(x: number, y: number) {
      moveToCalls.push([x, y])
      return this
    }

    lineTo(x: number, y: number) {
      lineToCalls.push([x, y])
      return this
    }

    close() {
      closeCalls++
      return this
    }

    detachAndDelete() {
      return detached
    }
  }

  const renderer = asRenderer({
    ck: {
      PathBuilder: MockPathBuilder,
      Color4f: mock((r: number, g: number, b: number, a: number) => ['color', r, g, b, a]),
      StrokeCap: { Butt: 'butt-cap' }
    },
    fillPaint: {
      setColor: mock(() => undefined),
      setAlphaf: mock(() => undefined),
      setShader: mock(() => undefined)
    },
    strokePaint: {
      setColor: mock(() => undefined),
      setStrokeWidth: mock(() => undefined),
      setAlphaf: mock(() => undefined),
      setStrokeCap: mock(() => undefined),
      setPathEffect: mock(() => undefined),
      setShader: mock(() => undefined)
    }
  })

  const drawPath = mock(() => undefined)
  const canvas = asCanvas({
    drawPath,
    drawLine: (x1: number, y1: number, x2: number, y2: number) => {
      drawLineCalls.push([x1, y1, x2, y2])
    }
  })

  return {
    renderer,
    canvas,
    detached,
    drawPath,
    counters: () => ({ pathsBuilt, closeCalls }),
    moveToCalls,
    lineToCalls,
    drawLineCalls
  }
}

const color = { r: 0.1, g: 0.2, b: 0.3, a: 1 }

describe('drawArrowHeads', () => {
  test('fills a closed triangle for an equilateral endpoint', () => {
    const harness = createHarness()

    drawArrowHeads(
      harness.renderer,
      harness.canvas,
      [{ x: 10, y: 5, angle: 0, cap: 'ARROW_EQUILATERAL' }],
      2,
      color,
      0.8
    )

    expect(harness.counters()).toEqual({ pathsBuilt: 1, closeCalls: 1 })
    expect(harness.moveToCalls).toEqual([[10, 5]])
    expect(harness.lineToCalls).toHaveLength(2)
    const corners = [...harness.lineToCalls].sort((a, b) => a[1] - b[1])
    expect(corners[0][0]).toBeCloseTo(10 - 4 * SQRT3, 5)
    expect(corners[0][1]).toBeCloseTo(1, 5)
    expect(corners[1][0]).toBeCloseTo(10 - 4 * SQRT3, 5)
    expect(corners[1][1]).toBeCloseTo(9, 5)
    expect(harness.renderer.fillPaint.setColor).toHaveBeenCalledWith(['color', 0.1, 0.2, 0.3, 1])
    expect(harness.renderer.fillPaint.setAlphaf).toHaveBeenCalledWith(0.8)
    expect(harness.drawPath).toHaveBeenCalledWith(harness.detached, harness.renderer.fillPaint)
    expect(harness.detached.delete).toHaveBeenCalled()
    expect(harness.drawLineCalls).toHaveLength(0)
  })

  test('strokes two wings for a lines endpoint without a dash effect', () => {
    const harness = createHarness()

    drawArrowHeads(
      harness.renderer,
      harness.canvas,
      [{ x: 0, y: 0, angle: 0, cap: 'ARROW_LINES' }],
      1,
      color,
      1
    )

    expect(harness.drawLineCalls).toHaveLength(2)
    const wings = [...harness.drawLineCalls].sort((a, b) => a[3] - b[3])
    expect(wings[0][0]).toBeCloseTo(0, 5)
    expect(wings[0][1]).toBeCloseTo(0, 5)
    expect(wings[0][2]).toBeCloseTo(-2 * SQRT3, 5)
    expect(wings[0][3]).toBeCloseTo(-2, 5)
    expect(wings[1][2]).toBeCloseTo(-2 * SQRT3, 5)
    expect(wings[1][3]).toBeCloseTo(2, 5)
    expect(harness.renderer.strokePaint.setStrokeWidth).toHaveBeenCalledWith(1)
    expect(harness.renderer.strokePaint.setStrokeCap).toHaveBeenCalledWith('butt-cap')
    expect(harness.renderer.strokePaint.setPathEffect).toHaveBeenCalledWith(null)
    expect(harness.drawPath).not.toHaveBeenCalled()
  })

  test('draws nothing for an empty endpoint list', () => {
    const harness = createHarness()

    drawArrowHeads(harness.renderer, harness.canvas, [], 2, color, 1)

    expect(harness.counters()).toEqual({ pathsBuilt: 0, closeCalls: 0 })
    expect(harness.drawPath).not.toHaveBeenCalled()
    expect(harness.drawLineCalls).toHaveLength(0)
  })
})
