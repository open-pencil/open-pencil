import { describe, test, expect, mock } from 'bun:test'

import { applyGradientFill } from '#core/canvas/fills'
import { LRUMap } from '#core/lru-map'
import type { Color, SceneNode, Fill } from '#core/scene-graph'

/**
 * Since gradientShaderKey is now a module-private function (after FIX-02),
 * we test its behavior indirectly through applyGradientFill and the
 * shaderCache. The observable behavior proves:
 * 1. Consistent keys for same inputs (cache hits)
 * 2. Different keys for different inputs (cache misses)
 * 3. Numeric keys (not strings) — no string allocation
 */

/** Minimal renderer subset needed for applyGradientFill tests */
interface GradientShaderTestRenderer {
  ck: {
    Color4f: (r: number, g: number, b: number, a: number) => Float32Array
    TileMode: { Clamp: number }
    Matrix: {
      multiply: (...matrices: Float32Array[]) => Float32Array
      scaled: (sx: number, sy: number) => Float32Array
    }
    Shader: {
      MakeLinearGradient: (...args: unknown[]) => { delete(): void }
      MakeRadialGradient: (...args: unknown[]) => { delete(): void }
      MakeSweepGradient: (...args: unknown[]) => { delete(): void }
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
    _graph: GradientShaderTestGraph
  ) => { color: Color }
  shaderCache: {
    get: (key: number) => unknown
    set: (key: number, value: unknown) => void
  }
  imageCache: {
    get: () => unknown
    set: () => void
  }
}

/** Minimal graph subset needed for applyGradientFill tests */
interface GradientShaderTestGraph {
  getNode: (_id: string) => SceneNode | null
  images: Map<string, unknown>
}

function createMockRendererForGradient(): {
  r: GradientShaderTestRenderer
  shaderCacheSetCalls: { key: number; value: unknown }[]
} {
  const shaderCacheSetCalls: { key: number; value: unknown }[] = []
  const shaderCache = new Map<number, unknown>()

  const r: GradientShaderTestRenderer = {
    ck: {
      Color4f: (r: number, g: number, b: number, a: number) => new Float32Array([r, g, b, a]),
      TileMode: { Clamp: 1 },
      Matrix: {
        multiply: (..._matrices: Float32Array[]) => {
          // Return identity matrix for simple testing
          return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
        },
        scaled: (_sx: number, _sy: number) => new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
      },
      Shader: {
        MakeLinearGradient: (...args: unknown[]) => ({
          kind: 'linear',
          args,
          delete: () => undefined
        }),
        MakeRadialGradient: (...args: unknown[]) => ({
          kind: 'radial',
          args,
          delete: () => undefined
        }),
        MakeSweepGradient: (...args: unknown[]) => ({
          kind: 'sweep',
          args,
          delete: () => undefined
        })
      }
    },
    fillPaint: {
      setShader: mock((_shader: unknown) => undefined),
      setColor: (_color: Float32Array) => undefined,
      setAlphaf: (_alpha: number) => undefined,
      delete: () => undefined
    },
    resolveFillColorInfo: (
      fill: Fill,
      _index: number,
      _node: SceneNode,
      _graph: GradientShaderTestGraph
    ) => ({
      color: fill.color
    }),
    shaderCache: {
      get: (key: number) => shaderCache.get(key),
      set: (key: number, value: unknown) => {
        shaderCache.set(key, value)
        shaderCacheSetCalls.push({ key, value })
      }
    },
    imageCache: {
      get: () => undefined,
      set: () => undefined
    }
  }

  return { r, shaderCacheSetCalls }
}

function createTrackedRendererWithLruShaderCache(capacity = 200): {
  r: GradientShaderTestRenderer
  deletedShaders: string[]
  shaderCache: LRUMap<number, unknown>
} {
  const deletedShaders: string[] = []
  const shaderCache = new LRUMap<number, unknown>(capacity)
  let shaderId = 0

  const makeShader = (kind: string) => {
    const id = ++shaderId
    return {
      kind,
      id,
      delete: () => {
        deletedShaders.push(`${kind}-${id}`)
      }
    }
  }

  const r: GradientShaderTestRenderer = {
    ck: {
      Color4f: (r: number, g: number, b: number, a: number) => new Float32Array([r, g, b, a]),
      TileMode: { Clamp: 1 },
      Matrix: {
        multiply: (..._matrices: Float32Array[]) => new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
        scaled: (_sx: number, _sy: number) => new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
      },
      Shader: {
        MakeLinearGradient: (..._args: unknown[]) => makeShader('linear'),
        MakeRadialGradient: (..._args: unknown[]) => makeShader('radial'),
        MakeSweepGradient: (..._args: unknown[]) => makeShader('sweep')
      }
    },
    fillPaint: {
      setShader: mock((_shader: unknown) => undefined),
      setColor: (_color: Float32Array) => undefined,
      setAlphaf: (_alpha: number) => undefined,
      delete: () => undefined
    },
    resolveFillColorInfo: (
      fill: Fill,
      _index: number,
      _node: SceneNode,
      _graph: GradientShaderTestGraph
    ) => ({
      color: fill.color
    }),
    shaderCache: {
      get: (key: number) => shaderCache.get(key),
      set: (key: number, value: unknown) => {
        shaderCache.set(key, value)
      }
    },
    imageCache: {
      get: () => undefined,
      set: () => undefined
    }
  }

  return { r, deletedShaders, shaderCache }
}

function createMockGraph(): GradientShaderTestGraph {
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

function makeRadialFill(overrides: Partial<Fill> = {}): Fill {
  return {
    type: 'GRADIENT_RADIAL',
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

function makeNode(overrides: Partial<SceneNode> = {}): SceneNode {
  return {
    id: 'test-node',
    type: 'RECTANGLE',
    width: 200,
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

const f64 = new Float64Array(1)
const f64View = new DataView(f64.buffer)

function floatToUint32Reference(value: number): number {
  f64[0] = value
  return (f64View.getUint32(0) ^ f64View.getUint32(4)) >>> 0
}

function mixFNV32(hash: number, value: number): number {
  return Math.imul(hash ^ value, 16777619) >>> 0
}

function referenceGradientShaderKey(fill: Fill, node: SceneNode): number {
  let hash = 2166136261
  let typeCode = 3
  if (fill.type === 'GRADIENT_LINEAR') typeCode = 0
  else if (fill.type === 'GRADIENT_RADIAL') typeCode = 1
  else if (fill.type === 'GRADIENT_DIAMOND') typeCode = 2
  hash = mixFNV32(hash, typeCode)
  hash = mixFNV32(hash, floatToUint32Reference(node.width))
  hash = mixFNV32(hash, floatToUint32Reference(node.height))

  const t = fill.gradientTransform
  if (t) {
    hash = mixFNV32(hash, floatToUint32Reference(t.m00))
    hash = mixFNV32(hash, floatToUint32Reference(t.m01))
    hash = mixFNV32(hash, floatToUint32Reference(t.m02))
    hash = mixFNV32(hash, floatToUint32Reference(t.m10))
    hash = mixFNV32(hash, floatToUint32Reference(t.m11))
    hash = mixFNV32(hash, floatToUint32Reference(t.m12))
  }

  const stops = fill.gradientStops ?? []
  hash = mixFNV32(hash, stops.length)
  for (const stop of stops) {
    hash = mixFNV32(hash, floatToUint32Reference(stop.position))
    hash = mixFNV32(hash, floatToUint32Reference(stop.color.r))
    hash = mixFNV32(hash, floatToUint32Reference(stop.color.g))
    hash = mixFNV32(hash, floatToUint32Reference(stop.color.b))
    hash = mixFNV32(hash, floatToUint32Reference(stop.color.a))
  }

  return hash
}

function makeKnownCollidingRadialFill(): Fill {
  return makeRadialFill({
    gradientTransform: {
      m00: 0.213671,
      m01: 0.036751,
      m02: 0.300495,
      m10: 0.35121,
      m11: 0.823737,
      m12: 0.767655
    },
    gradientStops: [
      { position: 0.356666, color: { r: 0.122733, g: 0.302615, b: 0.093957, a: 0.837005 } },
      { position: 0.769411, color: { r: 0.272223, g: 0.363414, b: 0.444161, a: 0.693481 } }
    ]
  })
}

function makeKnownCollidingDiamondFill(): Fill {
  return {
    type: 'GRADIENT_DIAMOND',
    visible: true,
    opacity: 1,
    blendMode: 'NORMAL',
    gradientTransform: {
      m00: 0.918547,
      m01: 0.875469,
      m02: 0.5544,
      m10: 0.136115,
      m11: 0.869336,
      m12: 0.926239
    },
    gradientStops: [
      { position: 0.305189, color: { r: 0.57374, g: 0.444221, b: 0.361114, a: 0.82536 } },
      { position: 0.522054, color: { r: 0.6972, g: 0.342094, b: 0.206401, a: 0.404885 } }
    ]
  } as Fill
}

describe('gradientShaderKey numeric hash (tested via shaderCache)', () => {
  test('same gradient inputs produce same numeric cache key', () => {
    const { r: r1, shaderCacheSetCalls: calls1 } = createMockRendererForGradient()
    const graph = createMockGraph()
    const fill = makeLinearFill()
    const node = makeNode()

    // First call: cache miss → shaderCache.set called
    applyGradientFill(r1, fill, node, graph)
    expect(calls1.length).toBe(1)
    const firstKey = calls1[0].key

    // Key must be a number (not a string — no string allocation!)
    expect(typeof firstKey).toBe('number')

    // Second call with SAME inputs must produce the SAME key
    const { r: r2, shaderCacheSetCalls: calls2 } = createMockRendererForGradient()
    applyGradientFill(r2, fill, node, graph)
    expect(calls2.length).toBe(1)
    const secondKey = calls2[0].key

    // Identical inputs → identical hash (proves determinism)
    expect(secondKey).toBe(firstKey)
  })

  test('different node dimensions produce different numeric cache keys', () => {
    // Test with first node
    const { r: r1, shaderCacheSetCalls: calls1 } = createMockRendererForGradient()
    const graph = createMockGraph()
    const fill = makeLinearFill()
    const node1 = makeNode({ width: 200, height: 100 })
    applyGradientFill(r1, fill, node1, graph)

    // Test with second node (different dimensions)
    const { r: r2, shaderCacheSetCalls: calls2 } = createMockRendererForGradient()
    const node2 = makeNode({ width: 300, height: 100 })
    applyGradientFill(r2, fill, node2, graph)

    expect(calls1.length).toBe(1)
    expect(calls2.length).toBe(1)
    // Different dimensions → different keys
    expect(calls1[0].key).not.toBe(calls2[0].key)
  })

  test('different gradient types produce different numeric cache keys', () => {
    const { r: r1, shaderCacheSetCalls: calls1 } = createMockRendererForGradient()
    const graph = createMockGraph()
    const linearFill = makeLinearFill()
    const node = makeNode()
    applyGradientFill(r1, linearFill, node, graph)

    const { r: r2, shaderCacheSetCalls: calls2 } = createMockRendererForGradient()
    const radialFill = makeRadialFill()
    applyGradientFill(r2, radialFill, node, graph)

    expect(calls1.length).toBe(1)
    expect(calls2.length).toBe(1)
    // Different gradient types → different keys
    expect(calls1[0].key).not.toBe(calls2[0].key)
  })

  test('cache key is numeric (no string allocation)', () => {
    const { r, shaderCacheSetCalls } = createMockRendererForGradient()
    const graph = createMockGraph()
    const fill = makeLinearFill()
    const node = makeNode()
    applyGradientFill(r, fill, node, graph)

    expect(shaderCacheSetCalls.length).toBe(1)
    const key = shaderCacheSetCalls[0].key

    // After FIX-02, the key must be a number, not a string.
    // Numbers don't allocate heap memory — zero GC pressure.
    expect(typeof key).toBe('number')
    // Numbers don't have a .length property (unlike strings)
    expect(key).not.toHaveProperty('length')
  })

  test('numeric cache key matches the 32-bit FNV reference implementation', () => {
    const { r, shaderCacheSetCalls } = createMockRendererForGradient()
    const graph = createMockGraph()
    const fill = makeLinearFill()
    const node = makeNode({ width: 1234.5, height: 678.25 })

    applyGradientFill(r, fill, node, graph)

    expect(shaderCacheSetCalls.length).toBe(1)
    expect(shaderCacheSetCalls[0].key).toBe(referenceGradientShaderKey(fill, node))
  })

  test('cache rejects real 32-bit hash collisions between distinct gradients', () => {
    const { r, shaderCacheSetCalls } = createMockRendererForGradient()
    const graph = createMockGraph()
    const node = makeNode({ width: 137, height: 83 })
    const fillA = makeKnownCollidingRadialFill()
    const fillB = makeKnownCollidingDiamondFill()

    expect(referenceGradientShaderKey(fillA, node)).toBe(referenceGradientShaderKey(fillB, node))

    applyGradientFill(r, fillA, node, graph)
    applyGradientFill(r, fillB, node, graph)

    expect(shaderCacheSetCalls.length).toBe(2)
    expect(shaderCacheSetCalls[0].value).not.toBe(shaderCacheSetCalls[1].value)
  })

  test('clearing the shader cache deletes cached gradient shaders', () => {
    const { r, deletedShaders, shaderCache } = createTrackedRendererWithLruShaderCache()
    const graph = createMockGraph()

    applyGradientFill(r, makeLinearFill(), makeNode(), graph)
    applyGradientFill(r, makeRadialFill(), makeNode(), graph)
    shaderCache.clear()

    expect(deletedShaders).toEqual(['linear-1', 'radial-2'])
  })

  test('clearing a collision bucket deletes every cached shader in that bucket', () => {
    const { r, deletedShaders, shaderCache } = createTrackedRendererWithLruShaderCache()
    const graph = createMockGraph()
    const node = makeNode({ width: 137, height: 83 })

    applyGradientFill(r, makeKnownCollidingRadialFill(), node, graph)
    applyGradientFill(r, makeKnownCollidingDiamondFill(), node, graph)

    expect(deletedShaders).toEqual([])

    shaderCache.clear()

    expect(deletedShaders).toEqual(['radial-1', 'radial-2'])
  })
})
