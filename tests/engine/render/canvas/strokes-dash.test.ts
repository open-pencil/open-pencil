/**
 * Tests for drawDashedRRectWithSolidCorners and drawStyledRRectStroke
 * dash-effect nested try/finally safety.
 */

import { describe, expect, mock, test } from 'bun:test'

import { drawDashedRRectWithSolidCorners, drawStyledRRectStroke } from '#core/canvas/strokes'
import type { SceneNode } from '#core/scene-graph'

import { createMockCanvas, createMockRenderer } from './helpers'

function makeDashEffect() {
  return { delete: mock(() => undefined) }
}

function makeNode(): SceneNode {
  return {
    id: 'node',
    type: 'RECTANGLE',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    visible: true,
    locked: false,
    opacity: 1,
    fills: [],
    strokes: [],
    effects: [],
    childIds: [],
    rotation: 0,
    flipX: false,
    flipY: false,
    cornerRadius: 0
  } as SceneNode
}

// ─── drawDashedRRectWithSolidCorners ───────────────────────────

describe('drawDashedRRectWithSolidCorners: dash effect nested try/finally safety', () => {
  test('dash effect is deleted after normal draw', () => {
    const dashEffect = makeDashEffect()
    const renderer = createMockRenderer({
      ck: {
        ...createMockRenderer().ck,
        PathEffect: { MakeDash: mock(() => dashEffect) }
      } as never
    })
    const canvas = createMockCanvas()
    const node = makeNode()
    const stroke = { dashPattern: [4, 4], weight: 1, opacity: 1, align: 'CENTER' } as never
    const color = { r: 0, g: 0, b: 0, a: 1 }

    drawDashedRRectWithSolidCorners(renderer as never, canvas as never, node, stroke, color, 5, 0)

    expect(dashEffect.delete).toHaveBeenCalled()
    expect(renderer.strokePaint.setPathEffect).toHaveBeenCalledWith(null)
  })

  test('dash effect is deleted even when drawLine throws', () => {
    const dashEffect = makeDashEffect()
    const renderer = createMockRenderer({
      ck: {
        ...createMockRenderer().ck,
        PathEffect: { MakeDash: mock(() => dashEffect) }
      } as never
    })
    const canvas = createMockCanvas({
      drawLine: () => {
        throw new Error('drawLine crash')
      }
    })
    const node = makeNode()
    const stroke = { dashPattern: [4, 4], weight: 1, opacity: 1, align: 'CENTER' } as never
    const color = { r: 0, g: 0, b: 0, a: 1 }

    expect(() => {
      drawDashedRRectWithSolidCorners(renderer as never, canvas as never, node, stroke, color, 5, 0)
    }).toThrow('drawLine crash')

    expect(dashEffect.delete).toHaveBeenCalled()
  })

  test('dash effect is deleted even when setPathEffect(null) throws', () => {
    const dashEffect = makeDashEffect()
    const renderer = createMockRenderer({
      ck: {
        ...createMockRenderer().ck,
        PathEffect: { MakeDash: mock(() => dashEffect) }
      } as never
    })
    let nullCallCount = 0
    renderer.strokePaint.setPathEffect = mock((val: unknown) => {
      if (val === null) {
        nullCallCount++
        // First null call (line 60, before arcs) succeeds;
        // second null call (finally block) throws
        if (nullCallCount > 1) throw new Error('setPathEffect(null) crash')
      }
    }) as never

    const canvas = createMockCanvas()
    const node = makeNode()
    const stroke = { dashPattern: [4, 4], weight: 1, opacity: 1, align: 'CENTER' } as never
    const color = { r: 0, g: 0, b: 0, a: 1 }

    expect(() => {
      drawDashedRRectWithSolidCorners(renderer as never, canvas as never, node, stroke, color, 5, 0)
    }).toThrow('setPathEffect(null) crash')

    expect(dashEffect.delete).toHaveBeenCalled()
  })

  test('null dash effect (no dash pattern): no crash', () => {
    const renderer = createMockRenderer()
    const canvas = createMockCanvas()
    const node = makeNode()
    const stroke = { dashPattern: [], weight: 1, opacity: 1, align: 'CENTER' } as never
    const color = { r: 0, g: 0, b: 0, a: 1 }

    drawDashedRRectWithSolidCorners(renderer as never, canvas as never, node, stroke, color, 5, 0)
    expect(renderer.strokePaint.setPathEffect).toHaveBeenCalledWith(null)
  })
})

// ─── drawStyledRRectStroke ────────────────────────────────────

describe('drawStyledRRectStroke: dash effect nested try/finally safety', () => {
  test('dash effect is deleted after normal draw', () => {
    const dashEffect = makeDashEffect()
    const renderer = createMockRenderer({
      ck: {
        ...createMockRenderer().ck,
        PathEffect: { MakeDash: mock(() => dashEffect) }
      } as never,
      drawRRectStrokeWithAlign: mock(() => undefined)
    })
    const canvas = createMockCanvas()
    const node = makeNode()
    const stroke = {
      dashPattern: [4, 4],
      weight: 1,
      opacity: 1,
      cap: 'ROUND',
      join: 'ROUND',
      align: 'CENTER'
    } as never
    const color = { r: 0, g: 0, b: 0, a: 1 }
    const rrect = new Float32Array(12)

    drawStyledRRectStroke(renderer as never, canvas as never, rrect, node, stroke, color, 0)

    expect(dashEffect.delete).toHaveBeenCalled()
    expect(renderer.strokePaint.setPathEffect).toHaveBeenCalledWith(null)
  })

  test('dash effect is deleted even when drawRRectStrokeWithAlign throws', () => {
    const dashEffect = makeDashEffect()
    const renderer = createMockRenderer({
      ck: {
        ...createMockRenderer().ck,
        PathEffect: { MakeDash: mock(() => dashEffect) }
      } as never,
      drawRRectStrokeWithAlign: mock(() => {
        throw new Error('draw crash')
      })
    })
    const canvas = createMockCanvas()
    const node = makeNode()
    const stroke = {
      dashPattern: [4, 4],
      weight: 1,
      opacity: 1,
      cap: 'ROUND',
      join: 'ROUND',
      align: 'CENTER'
    } as never
    const color = { r: 0, g: 0, b: 0, a: 1 }
    const rrect = new Float32Array(12)

    expect(() => {
      drawStyledRRectStroke(renderer as never, canvas as never, rrect, node, stroke, color, 0)
    }).toThrow('draw crash')

    expect(dashEffect.delete).toHaveBeenCalled()
  })

  test('dash effect is deleted even when setPathEffect(null) throws', () => {
    const dashEffect = makeDashEffect()
    const renderer = createMockRenderer({
      ck: {
        ...createMockRenderer().ck,
        PathEffect: { MakeDash: mock(() => dashEffect) }
      } as never,
      drawRRectStrokeWithAlign: mock(() => undefined)
    })
    renderer.strokePaint.setPathEffect = mock((val: unknown) => {
      if (val === null) throw new Error('setPathEffect(null) crash')
    }) as never

    const canvas = createMockCanvas()
    const node = makeNode()
    const stroke = {
      dashPattern: [4, 4],
      weight: 1,
      opacity: 1,
      cap: 'ROUND',
      join: 'ROUND',
      align: 'CENTER'
    } as never
    const color = { r: 0, g: 0, b: 0, a: 1 }
    const rrect = new Float32Array(12)

    expect(() => {
      drawStyledRRectStroke(renderer as never, canvas as never, rrect, node, stroke, color, 0)
    }).toThrow('setPathEffect(null) crash')

    expect(dashEffect.delete).toHaveBeenCalled()
  })

  test('null dash effect (empty dashPattern): no crash', () => {
    const renderer = createMockRenderer({
      drawRRectStrokeWithAlign: mock(() => undefined)
    })
    const canvas = createMockCanvas()
    const node = makeNode()
    const stroke = {
      dashPattern: [],
      weight: 1,
      opacity: 1,
      cap: 'ROUND',
      join: 'ROUND',
      align: 'CENTER'
    } as never
    const color = { r: 0, g: 0, b: 0, a: 1 }
    const rrect = new Float32Array(12)

    drawStyledRRectStroke(renderer as never, canvas as never, rrect, node, stroke, color, 0)
    expect(renderer.strokePaint.setPathEffect).toHaveBeenCalledWith(null)
  })
})
