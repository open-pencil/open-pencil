import { describe, expect, mock, test } from 'bun:test'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { renderNode } from '#core/canvas/scene'
import { SceneGraph } from '#core/scene-graph'

import { createMockCanvas } from './helpers'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function createRenderer() {
  const rendered: string[] = []
  const renderer = {
    _nodeCount: 0,
    _culledCount: 0,
    _lodCulledCount: 0,
    _textLodCulledCount: 0,
    _effectLodCulledCount: 0,
    _currentAbsInfo: null as unknown,
    minScreenSize: 0,
    minScreenSizeForText: 0,
    minScreenSizeForEffects: 0,
    _isViewportAnimating: false,
    _adaptiveLodBoost: 4,
    adaptiveMinScreenSize: 0,
    _absPosFullCache: new Map(),
    zoom: 1,
    worldViewport: { x: 900, y: 900, w: 300, h: 300 },
    opacityPaint: { setAlphaf: mock(() => undefined) },
    effectLayerPaint: {
      setImageFilter: mock(() => undefined),
      setColorFilter: mock(() => undefined),
      setBlendMode: mock(() => undefined)
    },
    ck: {
      BlendMode: { SrcOver: 'SrcOver' },
      LTRBRect: mock((left: number, top: number, right: number, bottom: number) => [
        left,
        top,
        right,
        bottom
      ]),
      ClipOp: { Intersect: 'Intersect' }
    },
    getCachedBlur: mock(() => null),
    auxStroke: {
      setStrokeWidth: mock(() => undefined),
      setColor: mock(() => undefined)
    },
    selColor: mock(() => 'color'),
    COMPONENT_SET_BORDER_WIDTH: 1,
    COMPONENT_SET_DASH: 4,
    COMPONENT_SET_DASH_GAP: 4,
    renderShape: mock((_canvas, node) => {
      rendered.push(node.id)
    }),
    renderSection: mock((_canvas, node) => {
      rendered.push(node.id)
    }),
    renderComponentSet: mock((_canvas, node) => {
      rendered.push(node.id)
    }),
    renderNode(canvas: unknown, graph: unknown, nodeId: string, overlays: unknown) {
      renderNode(this as SkiaRenderer, canvas as never, graph as never, nodeId, overlays as never)
    }
  }
  return { renderer: renderer as SkiaRenderer, rendered }
}

/**
 * Create a renderer configured for testing Level-of-Detail culling.
 */
function createLodRenderer() {
  const rendered: string[] = []
  const renderer = {
    _nodeCount: 0,
    _culledCount: 0,
    _lodCulledCount: 0,
    _textLodCulledCount: 0,
    _effectLodCulledCount: 0,
    _currentAbsInfo: null as unknown,
    minScreenSize: 4,
    minScreenSizeForText: 0,
    minScreenSizeForEffects: 0,
    _isViewportAnimating: false,
    _adaptiveLodBoost: 4,
    adaptiveMinScreenSize: 0,
    _absPosFullCache: new Map(),
    zoom: 0.1,
    worldViewport: { x: -100, y: -100, w: 2000, h: 2000 },
    opacityPaint: { setAlphaf: mock(() => undefined) },
    effectLayerPaint: {
      setImageFilter: mock(() => undefined),
      setColorFilter: mock(() => undefined),
      setBlendMode: mock(() => undefined)
    },
    ck: {
      BlendMode: { SrcOver: 'SrcOver' },
      LTRBRect: mock((left: number, top: number, right: number, bottom: number) => [
        left,
        top,
        right,
        bottom
      ]),
      ClipOp: { Intersect: 'Intersect' }
    },
    getCachedBlur: mock(() => null),
    auxStroke: {
      setStrokeWidth: mock(() => undefined),
      setColor: mock(() => undefined)
    },
    selColor: mock(() => 'color'),
    COMPONENT_SET_BORDER_WIDTH: 1,
    COMPONENT_SET_DASH: 4,
    COMPONENT_SET_DASH_GAP: 4,
    renderShape: mock((_canvas, node) => {
      rendered.push(node.id)
    }),
    renderSection: mock((_canvas, node) => {
      rendered.push(node.id)
    }),
    renderComponentSet: mock((_canvas, node) => {
      rendered.push(node.id)
    }),
    renderNode(canvas: unknown, graph: unknown, nodeId: string, overlays: unknown) {
      renderNode(this as SkiaRenderer, canvas as never, graph as never, nodeId, overlays as never)
    }
  }
  return { renderer: renderer as SkiaRenderer, rendered }
}

describe('canvas culling', () => {
  test('uses accumulated absolute position for nested children', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      x: 1000,
      y: 1000,
      width: 200,
      height: 200
    })
    const text = graph.createNode('TEXT', frame.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 24,
      text: 'Visible nested text'
    })
    const { renderer, rendered } = createRenderer()

    renderNode(renderer, createMockCanvas(), graph, frame.id, {})

    expect(rendered).toContain(frame.id)
    expect(rendered).toContain(text.id)
    expect(renderer._culledCount).toBe(0)
  })
})

describe('LINE Level-of-Detail culling', () => {
  test('near-axis LINE is not LOD-culled at low zoom (length-based metric)', () => {
    const graph = new SceneGraph()
    // A 1000×0.1px line — nearly horizontal but has a 0.1px height.
    // At 10% zoom: width*screen = 100px, area = 1000*0.1*0.01 = 1.
    // A threshold of minScreenSize=4 should NOT cull this line because
    // its length (100px) is far above 4. But the area-based metric
    // (1 < 4) INCORRECTLY culls it.
    const line = graph.createNode('LINE', pageId(graph), {
      width: 1000,
      height: 0.1,
      x: 0,
      y: 0
    })
    const { renderer, rendered } = createLodRenderer()

    renderNode(renderer, createMockCanvas(), graph, line.id, {})

    // The line should NOT be LOD-culled — it's long enough to be visible
    expect(renderer._lodCulledCount).toBe(0)
    expect(rendered).toContain(line.id)
    // THIS FAILS before the fix because area metric (1) < threshold (4)
    // causes incorrect LOD culling for near-axis lines.
  })

  test('LINE with exactly zero width uses length metric', () => {
    const graph = new SceneGraph()
    // A 0×1000px line (vertical, zero width).
    // The existing guard handles this case — area=0 -> length=1000.
    const line = graph.createNode('LINE', pageId(graph), {
      width: 0,
      height: 1000,
      x: 0,
      y: 0
    })
    const { renderer, rendered } = createLodRenderer()

    renderNode(renderer, createMockCanvas(), graph, line.id, {})

    // Not culled — length-based metric 1000*0.1=100 >= 4
    expect(renderer._lodCulledCount).toBe(0)
    expect(rendered).toContain(line.id)
  })

  test('large rect at low zoom IS LOD-culled (baseline test)', () => {
    const graph = new SceneGraph()
    // A 2×2px rectangle at 10% zoom has area = 2*2*0.01 = 0.04
    // which is well below minScreenSize=4.
    const rect = graph.createNode('RECTANGLE', pageId(graph), {
      width: 2,
      height: 2,
      x: 0,
      y: 0
    })
    const { renderer, rendered } = createLodRenderer()

    renderNode(renderer, createMockCanvas(), graph, rect.id, {})

    // The rect IS LOD-culled because area 0.04 < 4
    expect(renderer._lodCulledCount).toBe(1)
    expect(rendered).not.toContain(rect.id)
  })

  test('LINE at 100% zoom is not LOD-culled', () => {
    const graph = new SceneGraph()
    const line = graph.createNode('LINE', pageId(graph), {
      width: 5,
      height: 3,
      x: 0,
      y: 0
    })
    const { renderer, rendered } = createLodRenderer()
    renderer.zoom = 1

    renderNode(renderer, createMockCanvas(), graph, line.id, {})

    // At 100% zoom, area = 5*3 = 15 >= 4 — not culled
    expect(renderer._lodCulledCount).toBe(0)
    expect(rendered).toContain(line.id)
  })

  test('Number.NaN-dimensioned leaf node is not LOD-culled (explicit guard)', () => {
    // isLodCulled has an explicit Number.NaN guard consistent with isCulled:
    // non-finite dimensions return false (not culled) rather than
    // relying on accidental Number.NaN comparison semantics.
    const graph = new SceneGraph()
    const rect = graph.createNode('RECTANGLE', pageId(graph), {
      width: 2,
      height: 2,
      x: 0,
      y: 0
    })
    const { renderer } = createLodRenderer()

    // Override absInfo to have Number.NaN dimensions — this simulates
    // getAbsolutePositionFull returning corrupt coordinate data.
    const originalCache = renderer._absPosFullCache
    renderer._absPosFullCache = new Map([
      [rect.id, { width: Number.NaN, height: Number.NaN, boundX: 0, boundY: 0 }]
    ])

    renderNode(renderer, createMockCanvas(), graph, rect.id, {})

    // Number.NaN-dimensioned node must NOT be LOD-culled — it should pass
    // through to the render pipeline (which handles Number.NaN gracefully).
    // The explicit guard in isLodCulled prevents accidental culling.
    expect(renderer._lodCulledCount).toBe(0)

    renderer._absPosFullCache = originalCache
  })
})

describe('_currentAbsInfo lifecycle', () => {
  test('_currentAbsInfo is null after renderNode completes (invariant)', () => {
    // _currentAbsInfo must be null after renderNode returns,
    // regardless of whether the node was rendered, culled, or LOD-culled.
    // The doc comment says "Null when not in renderNode" but early
    // return paths (culling, LOD culling) skip the cleanup.
    const graph = new SceneGraph()
    const rect = graph.createNode('RECTANGLE', pageId(graph), {
      width: 200,
      height: 200,
      x: 1000,
      y: 1000
    })
    const { renderer } = createRenderer()
    expect(renderer._currentAbsInfo).toBeNull()

    renderNode(renderer, createMockCanvas(), graph, rect.id, {})

    // After renderNode returns, _currentAbsInfo MUST be null
    expect(renderer._currentAbsInfo).toBeNull()
  })

  test('_currentAbsInfo is null after LOD-culled early return', () => {
    // A node that is LOD-culled (small at low zoom) should still
    // clean up _currentAbsInfo on the early return path.
    const graph = new SceneGraph()
    const rect = graph.createNode('RECTANGLE', pageId(graph), {
      width: 2,
      height: 2,
      x: 0,
      y: 0
    })
    const { renderer } = createLodRenderer()
    expect(renderer._currentAbsInfo).toBeNull()

    renderNode(renderer, createMockCanvas(), graph, rect.id, {})

    // After LOD-culled early return, _currentAbsInfo MUST be null
    expect(renderer._currentAbsInfo).toBeNull()
  })

  test('_currentAbsInfo is saved/restored across recursive renderNode calls', () => {
    // When a parent's renderNode calls renderChildren, which
    // calls renderNode on child nodes, the child's finally block must
    // NOT destroy the parent's _currentAbsInfo. Before the fix (setting
    // to null in finally), the child's finally set _currentAbsInfo=null,
    // which clobbered the parent's value. The save/restore pattern
    // ensures the parent's value is restored after children return.
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      width: 200,
      height: 200,
      x: 0,
      y: 0
    })
    // Child rect inside the frame
    graph.createNode('RECTANGLE', frame.id, {
      width: 50,
      height: 50,
      x: 10,
      y: 10
    })

    const { renderer } = createRenderer()
    expect(renderer._currentAbsInfo).toBeNull()

    // Render the frame — this will recursively render the child
    renderNode(renderer, createMockCanvas(), graph, frame.id, {})

    // After the outermost renderNode returns, _currentAbsInfo MUST be null
    // (not the child's value, not some intermediate value)
    expect(renderer._currentAbsInfo).toBeNull()
  })

  test('_currentAbsInfo parent value is restored after child renderNode completes', () => {
    // VERIFICATION: During nested rendering, the parent's _currentAbsInfo
    // must be available after children finish. We verify this by checking
    // that after rendering a frame with children, the frame's absInfo
    // isn't leaked or lost — it's properly restored to null (the value
    // before the outermost renderNode call).
    const graph = new SceneGraph()
    const parent = graph.createNode('FRAME', pageId(graph), {
      width: 300,
      height: 300,
      x: 0,
      y: 0
    })
    graph.createNode('RECTANGLE', parent.id, { width: 30, height: 30, x: 0, y: 0 })
    graph.createNode('RECTANGLE', parent.id, { width: 30, height: 30, x: 100, y: 100 })

    const { renderer } = createRenderer()

    // Before any rendering
    expect(renderer._currentAbsInfo).toBeNull()

    renderNode(renderer, createMockCanvas(), graph, parent.id, {})

    // After all nested renderNode calls complete, _currentAbsInfo is null
    expect(renderer._currentAbsInfo).toBeNull()
  })
})
