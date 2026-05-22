import { describe, test, expect, mock } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import {
  applyGradientFill,
  drawNodeFill,
  hasValidDimensions,
  hasValidLineDimensions
} from '#core/canvas/fills'
import { drawNodeStroke, strokeNodeShape } from '#core/canvas/strokes'
import type { Color, SceneNode, Fill } from '#core/scene-graph'

/**
 * Mock renderer that records all CanvasKit shader factory calls.
 * This lets us verify that applyGradientFill guards against invalid dimensions
 * by checking that no shader factory is called when dimensions are bad.
 */

/** Minimal renderer subset needed for applyGradientFill guard tests */
interface GradientGuardRenderer {
  ck: {
    Color4f: (r: number, g: number, b: number, a: number) => Float32Array
    TileMode: { Clamp: number }
    Matrix: {
      multiply: (..._matrices: Float32Array[]) => Float32Array
      scaled: (_sx: number, _sy: number) => Float32Array
    }
    Shader: {
      MakeLinearGradient: (..._args: unknown[]) => { delete(): void }
      MakeRadialGradient: (..._args: unknown[]) => { delete(): void }
      MakeSweepGradient: (..._args: unknown[]) => { delete(): void }
    }
  }
  fillPaint: {
    setShader: (_shader: unknown) => void
    setColor: (_color: Float32Array) => void
    setAlphaf: (_alpha: number) => void
    delete: () => void
  }
  resolveFillColorInfo: (
    _fill: Fill,
    _index: number,
    _node: SceneNode,
    _graph: GradientGuardGraph
  ) => { color: Color }
  shaderCache: {
    get: (_key: number) => unknown
    set: (_key: number, _value: unknown) => void
  }
  imageCache: {
    get: () => unknown
    set: () => void
  }
}

/** Minimal graph subset needed for applyGradientFill tests */
interface GradientGuardGraph {
  getNode: (_id: string) => SceneNode | null
  images: Map<string, unknown>
}

/** Minimal renderer for drawNodeFill dimension guard tests */
interface DrawNodeFillRenderer {
  fillPaint: Record<string, unknown>
  drawNodeFill?: (..._args: unknown[]) => void
  makePolygonPath?: (..._args: unknown[]) => { delete(): void }
}

interface DrawNodeStrokeRenderer extends DrawNodeFillRenderer {
  strokePaint: Record<string, unknown>
}

function createMockRendererForGradient(): {
  r: GradientGuardRenderer
  shaderFactoryCalls: string[]
} {
  const shaderFactoryCalls: string[] = []

  const r: GradientGuardRenderer = {
    ck: {
      Color4f: (r: number, g: number, b: number, a: number) => new Float32Array([r, g, b, a]),
      TileMode: { Clamp: 1 },
      Matrix: {
        multiply: (..._matrices: Float32Array[]) => new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
        scaled: (_sx: number, _sy: number) => new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
      },
      Shader: {
        MakeLinearGradient: (..._args: unknown[]) => {
          shaderFactoryCalls.push('MakeLinearGradient')
          return { delete: () => undefined }
        },
        MakeRadialGradient: (..._args: unknown[]) => {
          shaderFactoryCalls.push('MakeRadialGradient')
          return { delete: () => undefined }
        },
        MakeSweepGradient: (..._args: unknown[]) => {
          shaderFactoryCalls.push('MakeSweepGradient')
          return { delete: () => undefined }
        }
      }
    },
    fillPaint: {
      setShader: (_shader: unknown) => undefined,
      setColor: (_color: Float32Array) => undefined,
      setAlphaf: (_alpha: number) => undefined,
      delete: () => undefined
    },
    resolveFillColorInfo: (
      _fill: Fill,
      _index: number,
      _node: SceneNode,
      _graph: GradientGuardGraph
    ) => ({
      color: { r: 1, g: 0, b: 0, a: 1 }
    }),
    shaderCache: {
      get: (_key: number) => undefined,
      set: (_key: number, _value: unknown) => undefined
    },
    imageCache: {
      get: () => undefined,
      set: () => undefined
    }
  }

  return { r, shaderFactoryCalls }
}

function createMockGraph(): GradientGuardGraph {
  return {
    getNode: (_id: string) => null,
    images: new Map()
  }
}

function makeLinearFill(overrides: Partial<Fill> = {}): Fill {
  return {
    type: 'GRADIENT_LINEAR',
    visible: true,
    opacity: 1,
    blendMode: 'NORMAL',
    gradientStops: [
      { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
      { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
    ],
    gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
    ...overrides
  } as Fill
}

function makeRadialFill(): Fill {
  return {
    type: 'GRADIENT_RADIAL',
    visible: true,
    opacity: 1,
    blendMode: 'NORMAL',
    gradientStops: [
      { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
      { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
    ],
    gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
  } as Fill
}

function makeAngularFill(): Fill {
  return {
    type: 'GRADIENT_ANGULAR',
    visible: true,
    opacity: 1,
    blendMode: 'NORMAL',
    gradientStops: [
      { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
      { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
    ],
    gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
  } as Fill
}

function makeNode(overrides: Partial<SceneNode> = {}): SceneNode {
  return {
    id: 'test-node',
    type: 'RECTANGLE',
    width: 100,
    height: 100,
    x: 0,
    y: 0,
    rotation: 0,
    fills: [],
    strokes: [],
    effects: [],
    childIds: [],
    visible: true,
    opacity: 1,
    ...overrides
  } as SceneNode
}

describe('applyGradientFill Number.NaN guard (TDD — these MUST fail before the fix)', () => {
  test('Number.NaN width should NOT reach CanvasKit shader factories', () => {
    const { r, shaderFactoryCalls } = createMockRendererForGradient()
    const graph = createMockGraph()
    const fill = makeLinearFill()
    const node = makeNode({ width: Number.NaN, height: 100 })

    applyGradientFill(r, fill, node, graph)

    // This assertion MUST FAIL before the fix because applyGradientFill
    // does not guard against Number.NaN dimensions — Number.NaN flows into
    // startX = t.m02 * w (which becomes Number.NaN) and then into
    // r.ck.Shader.MakeLinearGradient([Number.NaN, ...], ...)
    expect(shaderFactoryCalls).toEqual([])
  })

  test('Number.NaN height should NOT reach CanvasKit shader factories', () => {
    const { r, shaderFactoryCalls } = createMockRendererForGradient()
    const graph = createMockGraph()
    const fill = makeLinearFill()
    const node = makeNode({ width: 100, height: Number.NaN })

    applyGradientFill(r, fill, node, graph)

    expect(shaderFactoryCalls).toEqual([])
  })

  test('Infinity width should NOT reach CanvasKit shader factories', () => {
    const { r, shaderFactoryCalls } = createMockRendererForGradient()
    const graph = createMockGraph()
    const fill = makeLinearFill()
    const node = makeNode({ width: Infinity, height: 100 })

    applyGradientFill(r, fill, node, graph)

    expect(shaderFactoryCalls).toEqual([])
  })

  test('Number.NaN dimensions for radial gradient should NOT reach MakeRadialGradient', () => {
    const { r, shaderFactoryCalls } = createMockRendererForGradient()
    const graph = createMockGraph()
    const fill = makeRadialFill()
    const node = makeNode({ width: Number.NaN, height: 100 })

    applyGradientFill(r, fill, node, graph)

    // Number.NaN reaches makeGradientLocalMatrix -> r.ck.Matrix.scaled(Number.NaN, 100)
    // which produces a degenerate matrix -> MakeRadialGradient with bad localMatrix
    expect(shaderFactoryCalls).toEqual([])
  })

  test('Number.NaN dimensions for angular gradient should NOT reach MakeSweepGradient', () => {
    const { r, shaderFactoryCalls } = createMockRendererForGradient()
    const graph = createMockGraph()
    const fill = makeAngularFill()
    const node = makeNode({ width: 100, height: Number.NaN })

    applyGradientFill(r, fill, node, graph)

    expect(shaderFactoryCalls).toEqual([])
  })

  test('Number.NaN in gradientTransform should NOT reach CanvasKit', () => {
    const { r, shaderFactoryCalls } = createMockRendererForGradient()
    const graph = createMockGraph()
    const fill = makeLinearFill({
      gradientTransform: { m00: Number.NaN, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    })
    const node = makeNode({ width: 100, height: 100 })

    applyGradientFill(r, fill, node, graph)

    // Number.NaN in gradientTransform produces Number.NaN coordinates:
    // startX = t.m02 * w = 0 * 100 = 0 (ok)
    // endX = (t.m00 + t.m02) * w = (Number.NaN + 0) * 100 = Number.NaN
    expect(shaderFactoryCalls).toEqual([])
  })
})

describe('applyGradientFill zero-dimension guard (TDD — these MUST fail before the fix)', () => {
  test('zero width should NOT reach CanvasKit shader factories', () => {
    const { r, shaderFactoryCalls } = createMockRendererForGradient()
    const graph = createMockGraph()
    const fill = makeLinearFill()
    const node = makeNode({ width: 0, height: 100 })

    applyGradientFill(r, fill, node, graph)

    // Zero width produces degenerate coordinates for linear gradient:
    // startX = t.m02 * 0 = 0
    // endX = (t.m00 + t.m02) * 0 = 0
    // startX === endX -> zero-length gradient vector
    expect(shaderFactoryCalls).toEqual([])
  })

  test('zero height should NOT reach CanvasKit shader factories', () => {
    const { r, shaderFactoryCalls } = createMockRendererForGradient()
    const graph = createMockGraph()
    const fill = makeLinearFill()
    const node = makeNode({ width: 100, height: 0 })

    applyGradientFill(r, fill, node, graph)

    expect(shaderFactoryCalls).toEqual([])
  })

  test('zero dimensions for radial gradient should NOT reach makeGradientLocalMatrix', () => {
    const { r, shaderFactoryCalls } = createMockRendererForGradient()
    const graph = createMockGraph()
    const fill = makeRadialFill()
    const node = makeNode({ width: 0, height: 0 })

    applyGradientFill(r, fill, node, graph)

    // r.ck.Matrix.scaled(0, 0) produces a singular matrix
    expect(shaderFactoryCalls).toEqual([])
  })

  test('negative dimensions should NOT reach CanvasKit shader factories', () => {
    const { r, shaderFactoryCalls } = createMockRendererForGradient()
    const graph = createMockGraph()
    const fill = makeLinearFill()
    const node = makeNode({ width: -50, height: 100 })

    applyGradientFill(r, fill, node, graph)

    expect(shaderFactoryCalls).toEqual([])
  })
})

describe('applyGradientFill valid inputs (positive control — proves guard does not over-reject)', () => {
  test('valid linear gradient SHOULD reach MakeLinearGradient', () => {
    const { r, shaderFactoryCalls } = createMockRendererForGradient()
    const graph = createMockGraph()
    const fill = makeLinearFill()
    const node = makeNode({ width: 100, height: 100 })

    applyGradientFill(r, fill, node, graph)

    // Valid dimensions + finite transform → shader factory MUST be called
    expect(shaderFactoryCalls).toContain('MakeLinearGradient')
    expect(shaderFactoryCalls.length).toBe(1)
  })

  test('valid radial gradient SHOULD reach MakeRadialGradient', () => {
    const { r, shaderFactoryCalls } = createMockRendererForGradient()
    const graph = createMockGraph()
    const fill = makeRadialFill()
    const node = makeNode({ width: 200, height: 200 })

    applyGradientFill(r, fill, node, graph)

    expect(shaderFactoryCalls).toContain('MakeRadialGradient')
    expect(shaderFactoryCalls.length).toBe(1)
  })

  test('valid angular gradient SHOULD reach MakeSweepGradient', () => {
    const { r, shaderFactoryCalls } = createMockRendererForGradient()
    const graph = createMockGraph()
    const fill = makeAngularFill()
    const node = makeNode({ width: 100, height: 100 })

    applyGradientFill(r, fill, node, graph)

    expect(shaderFactoryCalls).toContain('MakeSweepGradient')
    expect(shaderFactoryCalls.length).toBe(1)
  })
})

describe('drawNodeFill dimension guard', () => {
  // drawNodeFill now guards dimension-dependent operations (LINE, ELLIPSE w/o arcData, default rect)
  // against Number.NaN/Infinity/zero/negative dimensions. VECTOR and TEXT are exempt.
  test('LINE with Number.NaN dimensions should NOT call drawLine', () => {
    const drawLineCalls: unknown[] = []
    const r: DrawNodeFillRenderer = {
      fillPaint: {},
      drawNodeFill: undefined
    }
    const canvas: Partial<Canvas> = {
      drawLine: mock((_x1: number, _y1: number, _x2: number, _y2: number) => {
        drawLineCalls.push('drawLine')
      })
    }
    const node = { ...makeNode({ width: Number.NaN, height: 100 }), type: 'LINE' } as SceneNode
    const rect = new Float32Array([0, 0, Number.NaN, 100])

    drawNodeFill(r, canvas, node, rect, false)

    expect(drawLineCalls.length).toBe(0)
  })

  test('LINE with valid dimensions SHOULD call drawLine', () => {
    const drawLineCalls: unknown[] = []
    const r: DrawNodeFillRenderer = {
      fillPaint: {},
      drawNodeFill: undefined
    }
    const canvas: Partial<Canvas> = {
      drawLine: mock((_x1: number, _y1: number, _x2: number, _y2: number) => {
        drawLineCalls.push('drawLine')
      })
    }
    const node = { ...makeNode({ width: 200, height: 100 }), type: 'LINE' } as SceneNode
    const rect = new Float32Array([0, 0, 200, 100])

    drawNodeFill(r, canvas, node, rect, false)

    expect(drawLineCalls.length).toBe(1)
  })

  test('horizontal LINE SHOULD call drawLine', () => {
    const drawLineCalls: unknown[] = []
    const r: DrawNodeFillRenderer = {
      fillPaint: {},
      drawNodeFill: undefined
    }
    const canvas: Partial<Canvas> = {
      drawLine: mock((_x1: number, _y1: number, _x2: number, _y2: number) => {
        drawLineCalls.push('drawLine')
      })
    }
    const node = { ...makeNode({ width: 200, height: 0 }), type: 'LINE' } as SceneNode
    const rect = new Float32Array([0, 0, 200, 0])

    drawNodeFill(r, canvas, node, rect, false)

    expect(drawLineCalls.length).toBe(1)
  })

  test('vertical LINE stroke SHOULD call drawLine', () => {
    const drawLineCalls: unknown[] = []
    const r: DrawNodeStrokeRenderer = {
      fillPaint: {},
      strokePaint: {},
      drawNodeFill: undefined
    }
    const canvas: Partial<Canvas> = {
      drawLine: mock((_x1: number, _y1: number, _x2: number, _y2: number) => {
        drawLineCalls.push('drawLine')
      })
    }
    const node = { ...makeNode({ width: 0, height: 200 }), type: 'LINE' } as SceneNode
    const rect = new Float32Array([0, 0, 0, 200])

    drawNodeStroke(r, canvas, node, rect, false)

    expect(drawLineCalls.length).toBe(1)
  })

  test('horizontal LINE overlay shape SHOULD call drawLine', () => {
    const drawLineCalls: unknown[] = []
    const r = {} as never
    const canvas: Partial<Canvas> = {
      drawLine: mock((_x1: number, _y1: number, _x2: number, _y2: number) => {
        drawLineCalls.push('drawLine')
      })
    }
    const node = { ...makeNode({ width: 200, height: 0 }), type: 'LINE' } as SceneNode

    strokeNodeShape(r, canvas as Canvas, node, {} as never)

    expect(drawLineCalls.length).toBe(1)
  })

  test('vertical LINE overlay shape SHOULD call drawLine', () => {
    const drawLineCalls: unknown[] = []
    const r = {} as never
    const canvas: Partial<Canvas> = {
      drawLine: mock((_x1: number, _y1: number, _x2: number, _y2: number) => {
        drawLineCalls.push('drawLine')
      })
    }
    const node = { ...makeNode({ width: 0, height: 200 }), type: 'LINE' } as SceneNode

    strokeNodeShape(r, canvas as Canvas, node, {} as never)

    expect(drawLineCalls.length).toBe(1)
  })

  test('POLYGON with Number.NaN dimensions should NOT call makePolygonPath', () => {
    const drawPathCalls: unknown[] = []
    const r: DrawNodeFillRenderer = {
      fillPaint: {},
      makePolygonPath: mock((..._args: unknown[]) => ({ delete: () => undefined }))
    }
    const canvas: Partial<Canvas> = {
      drawPath: mock(() => {
        drawPathCalls.push('drawPath')
      })
    }
    const node = { ...makeNode({ width: Number.NaN, height: 100 }), type: 'POLYGON' } as SceneNode
    const rect = new Float32Array([0, 0, Number.NaN, 100])

    drawNodeFill(r, canvas, node, rect, false)

    expect(drawPathCalls.length).toBe(0)
  })

  test('STAR with valid dimensions SHOULD call makePolygonPath', () => {
    const drawPathCalls: unknown[] = []
    const r: DrawNodeFillRenderer = {
      fillPaint: {},
      makePolygonPath: mock((..._args: unknown[]) => ({ delete: () => undefined }))
    }
    const canvas: Partial<Canvas> = {
      drawPath: mock(() => {
        drawPathCalls.push('drawPath')
      })
    }
    const node = { ...makeNode({ width: 200, height: 100 }), type: 'STAR' } as SceneNode
    const rect = new Float32Array([0, 0, 200, 100])

    drawNodeFill(r, canvas, node, rect, false)

    expect(drawPathCalls.length).toBe(1)
  })
})

describe('hasValidDimensions (exported, direct testing)', () => {
  test('Number.NaN width -> false', () => {
    expect(hasValidDimensions(Number.NaN, 100)).toBe(false)
  })

  test('Number.NaN height -> false', () => {
    expect(hasValidDimensions(100, Number.NaN)).toBe(false)
  })

  test('Infinity width -> false', () => {
    expect(hasValidDimensions(Infinity, 100)).toBe(false)
  })

  test('-Infinity width -> false', () => {
    expect(hasValidDimensions(-Infinity, 100)).toBe(false)
  })

  test('zero width -> false', () => {
    expect(hasValidDimensions(0, 100)).toBe(false)
  })

  test('zero height -> false', () => {
    expect(hasValidDimensions(100, 0)).toBe(false)
  })

  test('negative width -> false', () => {
    expect(hasValidDimensions(-1, 100)).toBe(false)
  })

  test('negative height -> false', () => {
    expect(hasValidDimensions(100, -1)).toBe(false)
  })

  test('valid dimensions -> true', () => {
    expect(hasValidDimensions(100, 100)).toBe(true)
  })

  test('very small positive dimensions -> true', () => {
    expect(hasValidDimensions(0.001, 0.001)).toBe(true)
  })

  test('MAX_VALUE dimensions -> true', () => {
    expect(hasValidDimensions(Number.MAX_VALUE, 1)).toBe(true)
  })

  test('both Number.NaN -> false', () => {
    expect(hasValidDimensions(Number.NaN, Number.NaN)).toBe(false)
  })

  test('both zero -> false', () => {
    expect(hasValidDimensions(0, 0)).toBe(false)
  })
})

describe('hasValidLineDimensions (exported, direct testing)', () => {
  test('horizontal line -> true', () => {
    expect(hasValidLineDimensions(200, 0)).toBe(true)
  })

  test('vertical line -> true', () => {
    expect(hasValidLineDimensions(0, 200)).toBe(true)
  })

  test('degenerate point -> false', () => {
    expect(hasValidLineDimensions(0, 0)).toBe(false)
  })
})
