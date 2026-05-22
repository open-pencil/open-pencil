import { describe, expect, mock, test } from 'bun:test'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { renderShapeUncached } from '#core/canvas/scene'

import { createMockCanvas, createMockGraph, createMockRenderer, makeWasmTracker } from './helpers'

describe('renderShapeUncached frees vector stroke paths on exception', () => {
  test('Paths allocated for vectorStrokePaths are cached and freed on cache clear when resolveStrokeColor throws', async () => {
    const { tracker, trackedDelete } = makeWasmTracker()

    const TrackedPath = class {
      constructor() {
        tracker.allocated++
      }
      delete() {
        trackedDelete()
      }
      copy() {
        tracker.allocated++
        return new TrackedPath()
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
      stroke = mock(() => null)
    }

    const canvas = createMockCanvas()

    // Use real LRUMap for stroke caches so the test can verify caching behavior
    const { LRUMap } = await import('#core/lru-map')
    const vectorStrokePathCache = new LRUMap<string, object[]>(200)

    const renderer = createMockRenderer({
      ck: {
        Color4f: (r: number, g: number, b: number, a: number) => [r, g, b, a],
        LTRBRect: (l: number, t: number, r: number, b: number) => [l, t, r, b],
        BlendMode: { SrcOver: 'SrcOver' },
        ClipOp: { Intersect: 'Intersect' },
        Path: TrackedPath,
        PathEffect: { MakeDash: () => ({ delete: mock(() => undefined) }) }
      } as SkiaRenderer['ck'],
      resolveStrokeColor: () => {
        throw new Error('simulated CK error in stroke resolution')
      },
      vectorStrokePathCache
    })

    const vectorNode = {
      id: 'vector-1',
      type: 'VECTOR',
      name: 'Test Vector',
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      visible: true,
      locked: false,
      opacity: 1,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }],
      strokes: [
        {
          visible: true,
          weight: 2,
          opacity: 1,
          color: { r: 0, g: 0, b: 0, a: 1 },
          cap: 'ROUND',
          join: 'MITER',
          dashPattern: [],
          align: 'CENTER'
        }
      ],
      effects: [],
      childIds: [],
      rotation: 0,
      flipX: false,
      flipY: false,
      cornerRadius: 0,
      strokeGeometry: [],
      vectorNetwork: {
        segments: [
          { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        vertices: [
          { x: 0, y: 0 },
          { x: 50, y: 50 },
          { x: 100, y: 100 }
        ]
      }
    } as SkiaRenderer['renderShapeUncached'] extends (
      r: never,
      c: never,
      node: infer N,
      ...args: never
    ) => N
      ? N
      : never

    const graph = createMockGraph()

    expect(() => {
      renderShapeUncached(renderer, canvas as never, vectorNode, graph)
    }).toThrow('simulated CK error in stroke resolution')

    // vectorStrokePaths now caches paths — they are owned by the cache,
    // not the caller. They should be present in the cache (not leaked
    // into the void) and freed when the cache is cleared.
    const cached = renderer.vectorStrokePathCache.get('vector-1')
    expect(cached).toBeDefined()
    expect(cached ? cached.length : 0).toBeGreaterThan(0)

    // Clearing the cache should free all cached paths
    renderer.vectorStrokePathCache.clear()
    expect(tracker.deleted).toBeGreaterThan(0)
    expect(tracker.allocated - tracker.deleted).toBe(0)
  })
})
