import { describe, test, expect, mock } from 'bun:test'

import { isAABBOutside, isCircleOutside, SceneGraph, type SceneNode } from '@open-pencil/core'
import { getAbsolutePositionFullCached, type AbsPosFullInfo } from '@open-pencil/core/canvas'

import { renderNode, renderShape, renderShapeUncached } from '#core/canvas/scene'

import { createMockCanvas, createMockRenderer } from './renderer/effects/helpers'

describe('getAbsolutePositionFullCached', () => {
  function createGraph(): { graph: SceneGraph; leaf: SceneNode } {
    const graph = new SceneGraph()
    // Remove auto-created page
    const pages = graph.getPages()
    for (const p of pages) graph.deleteNode(p.id)

    const page = graph.createNode('CANVAS', graph.rootId, {
      name: 'Page',
      width: 0,
      height: 0
    })
    const frame = graph.createNode('FRAME', page.id, {
      name: 'Frame',
      width: 100,
      height: 100,
      x: 10,
      y: 20
    })
    return { graph, leaf: frame }
  }

  test('cache miss computes and stores result', () => {
    const { graph, leaf } = createGraph()
    const cache = new Map<string, AbsPosFullInfo>()

    const result = getAbsolutePositionFullCached(leaf, graph, cache)
    expect(result.x).toBeGreaterThanOrEqual(0)
    expect(cache.has(leaf.id)).toBe(true)
    expect(cache.get(leaf.id)).toBe(result)
  })

  test('cache hit returns identical object reference', () => {
    const { graph, leaf } = createGraph()
    const cache = new Map<string, AbsPosFullInfo>()

    const first = getAbsolutePositionFullCached(leaf, graph, cache)
    const second = getAbsolutePositionFullCached(leaf, graph, cache)

    expect(second).toBe(first)
  })

  test('null cache falls through to uncached computation', () => {
    const { graph, leaf } = createGraph()

    // Should not throw
    const result = getAbsolutePositionFullCached(leaf, graph, null)
    expect(result.x).toBeGreaterThanOrEqual(0)
    expect(result.y).toBeGreaterThanOrEqual(0)
  })

  test('undefined cache falls through to uncached computation', () => {
    const { graph, leaf } = createGraph()

    const result = getAbsolutePositionFullCached(leaf, graph, undefined)
    expect(result.width).toBeGreaterThan(0)
    expect(result.height).toBeGreaterThan(0)
  })

  test('cached result has all expected fields', () => {
    const { graph, leaf } = createGraph()
    const cache = new Map<string, AbsPosFullInfo>()

    const result = getAbsolutePositionFullCached(leaf, graph, cache)

    // All 9 fields from getAbsolutePositionFull
    expect(typeof result.x).toBe('number')
    expect(typeof result.y).toBe('number')
    expect(typeof result.boundX).toBe('number')
    expect(typeof result.boundY).toBe('number')
    expect(typeof result.width).toBe('number')
    expect(typeof result.height).toBe('number')
    expect(typeof result.rotation).toBe('number')
    expect(typeof result.centerX).toBe('number')
    expect(typeof result.centerY).toBe('number')
  })

  test('empty cache computes fresh for each unique node', () => {
    const { graph, leaf } = createGraph()
    const frame2 = graph.createNode('FRAME', leaf.id, {
      name: 'Frame 2',
      width: 50,
      height: 50,
      x: 5,
      y: 5
    })

    const cache = new Map<string, AbsPosFullInfo>()

    const r1 = getAbsolutePositionFullCached(leaf, graph, cache)
    const r2 = getAbsolutePositionFullCached(frame2, graph, cache)

    expect(r1).not.toBe(r2)
    expect(cache.size).toBe(2)
  })
})

describe('renderNode culling', () => {
  test('non-clipping containers do not cull visible descendants with large negative offsets', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const group = graph.createNode('GROUP', page.id, {
      name: 'Offscreen group',
      x: 2000,
      y: 0,
      width: 100,
      height: 100
    })
    const child = graph.createNode('RECTANGLE', group.id, {
      name: 'Visible child',
      x: -1950,
      y: 50,
      width: 50,
      height: 50
    })

    const renderedIds: string[] = []
    const r = createMockRenderer({
      minScreenSize: 0,
      minScreenSizeForEffects: 0,
      _adaptiveLodBoost: 0,
      _isViewportAnimating: false,
      _absPosFullCache: new Map(),
      _nodeCount: 0,
      _culledCount: 0,
      _lodCulledCount: 0,
      _textLodCulledCount: 0,
      _effectLodCulledCount: 0,
      renderShape: mock((_canvas: unknown, node: SceneNode) => {
        renderedIds.push(node.id)
      })
    }) as ReturnType<typeof createMockRenderer> & {
      renderNode?: typeof renderNode
    }
    r.renderNode = (canvas, currentGraph, nodeId, overlays) =>
      renderNode(r as never, canvas, currentGraph, nodeId, overlays)

    renderNode(r as never, createMockCanvas() as never, graph, group.id, {})

    expect(renderedIds).toContain(group.id)
    expect(renderedIds).toContain(child.id)
  })

  test('base LOD does not cull visible horizontal lines', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const line = graph.createNode('LINE', page.id, {
      name: 'Horizontal line',
      x: 100,
      y: 100,
      width: 500,
      height: 0
    })

    const renderedIds: string[] = []
    const r = createMockRenderer({
      minScreenSize: 4,
      zoom: 1,
      minScreenSizeForEffects: 0,
      _adaptiveLodBoost: 0,
      _isViewportAnimating: false,
      _absPosFullCache: new Map(),
      _nodeCount: 0,
      _culledCount: 0,
      _lodCulledCount: 0,
      _textLodCulledCount: 0,
      _effectLodCulledCount: 0,
      renderShape: mock((_canvas: unknown, node: SceneNode) => {
        renderedIds.push(node.id)
      })
    }) as ReturnType<typeof createMockRenderer> & {
      renderNode?: typeof renderNode
    }
    r.renderNode = (canvas, currentGraph, nodeId, overlays) =>
      renderNode(r as never, canvas, currentGraph, nodeId, overlays)

    renderNode(r as never, createMockCanvas() as never, graph, line.id, {})

    expect(r._lodCulledCount).toBe(0)
    expect(renderedIds).toContain(line.id)
  })

  test('adaptive base LOD is disabled while idle but activates during viewport animation', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      name: 'Tiny rect',
      x: 100,
      y: 100,
      width: 20,
      height: 20
    })

    const renderedIds: string[] = []
    const r = createMockRenderer({
      minScreenSize: 0,
      adaptiveMinScreenSize: 4,
      minScreenSizeForEffects: 0,
      zoom: 0.05,
      _adaptiveLodBoost: 4,
      _isViewportAnimating: false,
      _absPosFullCache: new Map(),
      _nodeCount: 0,
      _culledCount: 0,
      _lodCulledCount: 0,
      _textLodCulledCount: 0,
      _effectLodCulledCount: 0,
      renderShape: mock((_canvas: unknown, node: SceneNode) => {
        renderedIds.push(node.id)
      })
    }) as ReturnType<typeof createMockRenderer> & {
      renderNode?: typeof renderNode
    }
    r.renderNode = (canvas, currentGraph, nodeId, overlays) =>
      renderNode(r as never, canvas, currentGraph, nodeId, overlays)

    renderNode(r as never, createMockCanvas() as never, graph, rect.id, {})
    expect(r._lodCulledCount).toBe(0)
    expect(renderedIds).toContain(rect.id)

    renderedIds.length = 0
    r._lodCulledCount = 0
    r._isViewportAnimating = true

    renderNode(r as never, createMockCanvas() as never, graph, rect.id, {})
    expect(r._lodCulledCount).toBe(1)
    expect(renderedIds).toEqual([])
  })
})

describe('renderShape error cleanup', () => {
  test('deletes PictureRecorder when effect recording throws', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'Effect node',
      width: 100,
      height: 80,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          radius: 8,
          offset: { x: 4, y: 4 },
          color: { r: 0, g: 0, b: 0, a: 0.3 },
          blendMode: 'NORMAL',
          spread: 0
        }
      ]
    })

    let recorderDeleted = false
    const recorder = {
      beginRecording: mock(() => createMockCanvas()),
      finishRecordingAsPicture: mock(() => ({ delete: mock(() => undefined) })),
      delete: mock(() => {
        recorderDeleted = true
      })
    }

    const r = createMockRenderer({
      renderShapeUncached: mock(() => {
        throw new Error('boom')
      })
    }) as ReturnType<typeof createMockRenderer> & {
      ck: ReturnType<typeof createMockRenderer>['ck'] & {
        PictureRecorder: new () => typeof recorder
      }
      effectOverflow: (_node: SceneNode) => number
    }
    r.ck = {
      ...r.ck,
      PictureRecorder: class {
        beginRecording = recorder.beginRecording
        finishRecordingAsPicture = recorder.finishRecordingAsPicture
        delete = recorder.delete
      }
    }
    r.effectOverflow = () => 12

    expect(() => renderShape(r as never, createMockCanvas() as never, node, graph)).toThrow('boom')
    expect(recorderDeleted).toBe(true)
  })
})

describe('line effect LOD', () => {
  test('renderShape does not effect-LOD cull horizontal lines with visible effects', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const line = graph.createNode('LINE', page.id, {
      name: 'Horizontal effect line',
      x: 100,
      y: 100,
      width: 500,
      height: 0,
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          radius: 8,
          offset: { x: 4, y: 4 },
          color: { r: 0, g: 0, b: 0, a: 0.3 },
          blendMode: 'NORMAL',
          spread: 0
        }
      ]
    })

    const recorder = {
      beginRecording: mock(() => createMockCanvas()),
      finishRecordingAsPicture: mock(() => ({ delete: mock(() => undefined) })),
      delete: mock(() => undefined)
    }
    const r = createMockRenderer({
      minScreenSizeForEffects: 1,
      _adaptiveLodBoost: 0,
      _isViewportAnimating: false,
      _effectLodCulledCount: 0,
      effectOverflow: (_node: SceneNode) => 12,
      renderShapeUncached: mock(() => undefined)
    }) as ReturnType<typeof createMockRenderer> & {
      ck: ReturnType<typeof createMockRenderer>['ck'] & {
        PictureRecorder: new () => typeof recorder
      }
      effectOverflow: (_node: SceneNode) => number
      renderShapeUncached: (_canvas: unknown, _node: SceneNode, _graph: SceneGraph) => void
    }
    r.ck = {
      ...r.ck,
      PictureRecorder: class {
        beginRecording = recorder.beginRecording
        finishRecordingAsPicture = recorder.finishRecordingAsPicture
        delete = recorder.delete
      }
    }

    renderShape(r as never, createMockCanvas() as never, line, graph)

    expect(r._effectLodCulledCount).toBe(0)
    expect(recorder.beginRecording).toHaveBeenCalledTimes(1)
    expect(r.renderShapeUncached).toHaveBeenCalledTimes(1)
  })

  test('renderShapeUncached still renders effects for horizontal lines above the threshold', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const line = graph.createNode('LINE', page.id, {
      name: 'Horizontal effect line',
      x: 100,
      y: 100,
      width: 500,
      height: 0,
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          radius: 8,
          offset: { x: 4, y: 4 },
          color: { r: 0, g: 0, b: 0, a: 0.3 },
          blendMode: 'NORMAL',
          spread: 0
        }
      ]
    })

    const effectPasses: string[] = []
    const r = createMockRenderer({
      minScreenSizeForEffects: 1,
      _adaptiveLodBoost: 0,
      _isViewportAnimating: false,
      renderEffects: mock(
        (
          _canvas: unknown,
          _node: SceneNode,
          _rect: Float32Array,
          _hasRadius: boolean,
          pass: string
        ) => {
          effectPasses.push(pass)
        }
      )
    })

    renderShapeUncached(r as never, createMockCanvas() as never, line, graph)

    expect(effectPasses).toEqual(['behind', 'front'])
  })

  test('renderNode does not skip layer blur for horizontal lines above the threshold', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const line = graph.createNode('LINE', page.id, {
      name: 'Horizontal blur line',
      x: 100,
      y: 100,
      width: 500,
      height: 0,
      effects: [
        {
          type: 'LAYER_BLUR',
          visible: true,
          radius: 8
        }
      ]
    })

    const canvas = createMockCanvas()
    const r = createMockRenderer({
      minScreenSize: 0,
      minScreenSizeForEffects: 1,
      _adaptiveLodBoost: 0,
      _isViewportAnimating: false,
      _absPosFullCache: new Map(),
      _nodeCount: 0,
      _culledCount: 0,
      _lodCulledCount: 0,
      _textLodCulledCount: 0,
      _effectLodCulledCount: 0
    }) as ReturnType<typeof createMockRenderer> & {
      renderNode?: typeof renderNode
    }
    r.renderNode = (currentCanvas, currentGraph, nodeId, overlays) =>
      renderNode(r as never, currentCanvas, currentGraph, nodeId, overlays)

    renderNode(r as never, canvas as never, graph, line.id, {})

    expect(canvas.saveLayer).toHaveBeenCalledTimes(1)
  })
})

describe('isAABBOutside — normal cases', () => {
  const vp = { x: 0, y: 0, w: 1000, h: 1000 }

  test('AABB fully inside viewport → false', () => {
    expect(isAABBOutside(100, 100, 200, 200, vp)).toBe(false)
  })

  test('AABB fully outside (right of viewport) → true', () => {
    expect(isAABBOutside(1001, 100, 1100, 200, vp)).toBe(true)
  })

  test('AABB fully outside (below viewport) → true', () => {
    expect(isAABBOutside(100, 1001, 200, 1100, vp)).toBe(true)
  })

  test('AABB fully outside (left of viewport) → true', () => {
    expect(isAABBOutside(-200, 100, -100, 200, vp)).toBe(true)
  })

  test('AABB fully outside (above viewport) → true', () => {
    expect(isAABBOutside(100, -200, 200, -100, vp)).toBe(true)
  })

  test('AABB touching boundary (right edge at vp right) → false', () => {
    // right = 1000, vp.x + vp.w = 1000 → NOT outside (right < vp.x is false)
    expect(isAABBOutside(0, 0, 1000, 1000, vp)).toBe(false)
  })

  test('AABB exactly at viewport boundary → false', () => {
    // left = 0, vp.x = 0 → left > vp.x + vp.w is false
    expect(isAABBOutside(0, 0, 1000, 1000, vp)).toBe(false)
  })
})

describe('isAABBOutside — Number.NaN inputs', () => {
  const vp = { x: 0, y: 0, w: 1000, h: 1000 }

  test('Number.NaN left → returns false (node NOT culled, renders to error boundary)', () => {
    // Number.NaN > x is always false, so the first condition fails.
    // But Number.NaN < x is also always false, so the third condition also fails.
    // Result: all four conditions are false → isAABBOutside returns false.
    // This is CORRECT: Number.NaN nodes should be rendered and caught by the
    // renderNode error boundary, not silently culled.
    expect(isAABBOutside(Number.NaN, 100, 200, 200, vp)).toBe(false)
  })

  test('Number.NaN top → returns false', () => {
    expect(isAABBOutside(100, Number.NaN, 200, 200, vp)).toBe(false)
  })

  test('Number.NaN right → returns false', () => {
    expect(isAABBOutside(100, 100, Number.NaN, 200, vp)).toBe(false)
  })

  test('Number.NaN bottom → returns false', () => {
    expect(isAABBOutside(100, 100, 200, Number.NaN, vp)).toBe(false)
  })

  test('All Number.NaN → returns false', () => {
    expect(isAABBOutside(Number.NaN, Number.NaN, Number.NaN, Number.NaN, vp)).toBe(false)
  })
})

describe('isAABBOutside — Number.NaN viewport', () => {
  const nanVP = { x: Number.NaN, y: Number.NaN, w: Number.NaN, h: Number.NaN }

  test('Number.NaN viewport → returns false (cannot determine culling)', () => {
    // With Number.NaN viewport, all comparisons return false →
    // isAABBOutside returns false → node is NOT culled.
    expect(isAABBOutside(100, 100, 200, 200, nanVP)).toBe(false)
  })
})

describe('isAABBOutside — Infinity inputs', () => {
  const vp = { x: 0, y: 0, w: 1000, h: 1000 }

  test('Infinity left → returns true (Infinity > 1000 = true → first OR condition satisfied → outside)', () => {
    // left > vp.x + vp.w → Infinity > 1000 → true → outside
    expect(isAABBOutside(Infinity, 100, 200, 200, vp)).toBe(true)
  })

  test('-Infinity right → returns true (right < vp.x = -Infinity < 0 = true)', () => {
    expect(isAABBOutside(100, 100, -Infinity, 200, vp)).toBe(true)
  })
})

describe('isCircleOutside — normal cases', () => {
  const vp = { x: 0, y: 0, w: 1000, h: 1000 }

  test('circle fully inside viewport → false', () => {
    expect(isCircleOutside(500, 500, 100, vp)).toBe(false)
  })

  test('circle fully outside (right) → true', () => {
    expect(isCircleOutside(1200, 500, 100, vp)).toBe(true)
  })

  test('circle fully outside (below) → true', () => {
    expect(isCircleOutside(500, 1200, 100, vp)).toBe(true)
  })

  test('circle fully outside (left) → true', () => {
    expect(isCircleOutside(-200, 500, 100, vp)).toBe(true)
  })

  test('circle fully outside (above) → true', () => {
    expect(isCircleOutside(500, -200, 100, vp)).toBe(true)
  })

  test('circle touching viewport edge → false', () => {
    // cx - radius = 0, which is NOT > vp.x + vp.w
    expect(isCircleOutside(100, 500, 100, vp)).toBe(false)
  })
})

describe('isCircleOutside — Number.NaN inputs', () => {
  const vp = { x: 0, y: 0, w: 1000, h: 1000 }

  test('Number.NaN cx → returns false (node NOT culled)', () => {
    // Number.NaN - radius > vp.x + vp.w → Number.NaN > 1000 → false
    // Number.NaN + radius < vp.x → Number.NaN < 0 → false
    // All conditions false → return false
    expect(isCircleOutside(Number.NaN, 500, 100, vp)).toBe(false)
  })

  test('Number.NaN cy → returns false', () => {
    expect(isCircleOutside(500, Number.NaN, 100, vp)).toBe(false)
  })

  test('Number.NaN radius → returns false', () => {
    expect(isCircleOutside(500, 500, Number.NaN, vp)).toBe(false)
  })

  test('All Number.NaN → returns false', () => {
    expect(isCircleOutside(Number.NaN, Number.NaN, Number.NaN, vp)).toBe(false)
  })
})

describe('isCircleOutside — edge cases', () => {
  const vp = { x: 0, y: 0, w: 1000, h: 1000 }

  test('zero radius at viewport center → not outside', () => {
    expect(isCircleOutside(500, 500, 0, vp)).toBe(false)
  })

  test('zero radius at viewport edge → not outside', () => {
    expect(isCircleOutside(0, 0, 0, vp)).toBe(false)
  })

  test('negative radius → returns false (not culled)', () => {
    // With negative radius, cx - (-r) = cx + r could be > vp.w
    // but the culling check is: cx - radius > vp.x + vp.w
    // For cx=500, radius=-100: 500 - (-100) = 600 > 1000? No.
    // cx + radius < vp.x → 500 + (-100) = 400 < 0? No.
    // So it returns false. This is acceptable — negative radius is invalid
    // but the node should be rendered and caught by the error boundary.
    expect(isCircleOutside(500, 500, -100, vp)).toBe(false)
  })
})
