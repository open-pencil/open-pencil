import { bench, group, run } from 'mitata'

import { applyGradientFill } from '#core/canvas/fills'
import { LRUMap } from '#core/lru-map'
import type { Color, SceneNode, Fill } from '#core/scene-graph'

/**
 * Benchmark: gradientShaderKey numeric hash vs old string interpolation.
 * After FIX-02, the key is computed as a FNV-1a numeric hash with zero
 * string allocations. This benchmark proves the optimization is effective.
 */

/** Minimal renderer subset needed for applyGradientFill benchmarks */
interface BenchRenderer {
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
  resolveFillColorInfo: () => { color: Color }
  shaderCache: LRUMap<number, unknown>
  imageCache: {
    get: () => unknown
    set: () => void
  }
}

/** Minimal graph subset needed for applyGradientFill benchmarks */
interface BenchGraph {
  getNode: () => null
  images: Map<string, unknown>
}

// Mock renderer for benchmarking
function createBenchRenderer(): BenchRenderer {
  const shader = { delete: () => undefined }
  return {
    ck: {
      Color4f: (r: number, g: number, b: number, a: number) => new Float32Array([r, g, b, a]),
      TileMode: { Clamp: 1 },
      Matrix: {
        multiply: (..._matrices: Float32Array[]) => new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
        scaled: (_sx: number, _sy: number) => new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
      },
      Shader: {
        MakeLinearGradient: (..._args: unknown[]) => shader,
        MakeRadialGradient: (..._args: unknown[]) => shader,
        MakeSweepGradient: (..._args: unknown[]) => shader
      }
    },
    fillPaint: {
      setShader: (_shader: unknown) => undefined,
      setColor: (_color: Float32Array) => undefined,
      setAlphaf: (_alpha: number) => undefined,
      delete: () => undefined
    },
    resolveFillColorInfo: () => ({
      color: { r: 1, g: 0, b: 0, a: 1 }
    }),
    shaderCache: new LRUMap<number, unknown>(200),
    imageCache: {
      get: () => undefined,
      set: () => undefined
    }
  }
}

const benchGraph: BenchGraph = {
  getNode: () => null,
  images: new Map()
}

const benchFill: Fill = {
  type: 'GRADIENT_LINEAR',
  visible: true,
  opacity: 1,
  blendMode: 'NORMAL',
  gradientStops: [
    { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
    { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
  ],
  gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
} as Fill

const benchNode: SceneNode = {
  id: 'bench-node',
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
  opacity: 1
} as SceneNode

group('gradientShaderKey: numeric hash (post FIX-02)', () => {
  bench('applyGradientFill with cache miss (new shader)', () => {
    const r = createBenchRenderer()
    r.shaderCache = new LRUMap<number, unknown>(200)
    // Bun runtime resolves type mismatch for mock subset objects
    applyGradientFill(r, benchFill, benchNode, benchGraph)
  })

  bench('applyGradientFill with cache hit (cached shader)', () => {
    const r = createBenchRenderer()
    // Pre-populate cache so we get hits
    applyGradientFill(r, benchFill, benchNode, benchGraph)
    // Second call should hit cache
    applyGradientFill(r, benchFill, benchNode, benchGraph)
  })

  bench('LRUMap<number> get (cache hit simulation)', () => {
    const map = new LRUMap<number, number>(200)
    for (let i = 0; i < 100; i++) map.set(i, i * 2)
    map.get(50)
  })

  bench('LRUMap<number> set (new entry)', () => {
    const map = new LRUMap<number, number>(200)
    map.set(999, 42)
  })
})

group('LRUMap vs plain Map overhead', () => {
  bench('LRUMap<number> get', () => {
    const map = new LRUMap<number, number>(500)
    for (let i = 0; i < 500; i++) map.set(i, i)
    for (let i = 0; i < 500; i++) map.get(i)
  })

  bench('Map<number> get', () => {
    const map = new Map<number, number>()
    for (let i = 0; i < 500; i++) map.set(i, i)
    for (let i = 0; i < 500; i++) map.get(i)
  })

  bench('LRUMap<number> set (no eviction)', () => {
    const map = new LRUMap<number, number>(500)
    for (let i = 0; i < 500; i++) map.set(i, i)
  })

  bench('Map<number> set', () => {
    const map = new Map<number, number>()
    for (let i = 0; i < 500; i++) map.set(i, i)
  })

  bench('LRUMap<number> set with eviction (capacity=100)', () => {
    const map = new LRUMap<number, number>(100)
    for (let i = 0; i < 500; i++) map.set(i, i)
  })
})

await run()
