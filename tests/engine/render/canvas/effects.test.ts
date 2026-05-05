import { describe, test, expect, mock } from 'bun:test'

import type { Canvas, Path } from 'canvaskit-wasm'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { renderNode, renderShapeUncached } from '#core/canvas/scene'
import { renderEffects } from '#core/canvas/shadows'
import type { SceneNode, SceneGraph } from '#core/scene-graph'

function mockCalls(fn: ReturnType<typeof mock>): unknown[][] {
  return (fn as { mock: { calls: unknown[][] } }).mock.calls
}

function createMockRenderer(overrides: Partial<SkiaRenderer> = {}): SkiaRenderer {
  return {
    ck: {
      Color4f: mock((r, g, b, a) => new Float32Array([r, g, b, a])),
      LTRBRect: mock((l, t, r, b) => new Float32Array([l, t, r, b])),
      RRectXY: mock(() => new Float32Array(12)),
      ClipOp: { Intersect: 0 },
      Path: class {
        addOval = mock(() => {})
        addRect = mock(() => {})
        addRRect = mock(() => {})
        op = mock(() => {})
        delete = mock(() => {})
        copy = mock(() => this)
        stroke = mock(() => this)
        moveTo = mock(() => {})
        lineTo = mock(() => {})
        cubicTo = mock(() => {})
        close = mock(() => {})
      },
      PathOp: { Difference: 0 },
      BlendMode: { SrcOver: 0, SrcIn: 1, DstOut: 2 },
      ColorType: { RGBA_8888: 0 },
      AlphaType: { Premul: 0, Unpremul: 1 },
      ColorSpace: { SRGB: 0 },
      TileMode: { Decal: 0, Clamp: 1, Repeat: 2, Mirror: 3 },
      FilterMode: { Nearest: 0, Linear: 1 },
      MipmapMode: { None: 0, Nearest: 1, Linear: 2 },
      BLACK: new Float32Array([0, 0, 0, 1]),
      WHITE: new Float32Array([1, 1, 1, 1]),
      TRANSPARENT: new Float32Array([0, 0, 0, 0]),
      Paint: class {
        setColor = mock(() => {})
        setShader = mock(() => {})
        delete = mock(() => {})
      },
      ColorFilter: {
        MakeBlend: mock(() => ({ delete: () => {} })),
        MakeMatrix: mock(() => ({ delete: () => {} }))
      }
    },
    auxFill: {
      setColor: mock(() => {}),
      setMaskFilter: mock(() => {}),
      setImageFilter: mock(() => {}),
      setAlphaf: mock(() => {}),
      setBlendMode: mock(() => {}),
      setShader: mock(() => {}),
      delete: mock(() => {})
    },
    auxStroke: {
      setStrokeWidth: mock(() => {}),
      setColor: mock(() => {}),
      setPathEffect: mock(() => {}),
      setAlphaf: mock(() => {}),
      setBlendMode: mock(() => {}),
      delete: mock(() => {})
    },
    fillPaint: {
      setColor: mock(() => {}),
      setAlphaf: mock(() => {}),
      setShader: mock(() => {}),
      getColor: mock(() => new Float32Array([0, 0, 0, 1])),
      setBlendMode: mock(() => {}),
      delete: mock(() => {})
    },
    strokePaint: {
      setColor: mock(() => {}),
      setStrokeWidth: mock(() => {}),
      setAlphaf: mock(() => {}),
      setPathEffect: mock(() => {}),
      setStrokeCap: mock(() => {}),
      setStrokeJoin: mock(() => {}),
      setBlendMode: mock(() => {}),
      delete: mock(() => {})
    },
    opacityPaint: {
      setAlphaf: mock(() => {}),
      setBlendMode: mock(() => {}),
      delete: mock(() => {})
    },
    effectLayerPaint: {
      setColor: mock(() => {}),
      setMaskFilter: mock(() => {}),
      setImageFilter: mock(() => {}),
      setColorFilter: mock(() => {}),
      setBlendMode: mock(() => {}),
      delete: mock(() => {})
    },
    color4f: mock((r, g, b, a) => new Float32Array([r, g, b, a])),
    ltrb: mock((l, t, r, b) => new Float32Array([l, t, r, b])),
    getCachedMaskBlur: mock(() => ({})),
    getCachedDropShadow: mock(() => ({})),
    getCachedDecalBlur: mock(() => ({})),
    getCachedBlur: mock(() => ({})),
    getStrokeGeometry: mock(() => null),
    getFillGeometry: mock(() => null),
    getVectorPaths: mock(() => null),
    makeRRect: mock(() => new Float32Array(12)),
    makeRRectWithSpread: mock(() => new Float32Array(12)),
    makeRRectWithOffset: mock(() => new Float32Array(12)),
    renderText: mock(() => {}),
    applyClippedBlur: mock(() => {}),
    applyFill: mock(() => true),
    renderShape: mock(() => {}),
    renderSection: mock(() => {}),
    renderComponentSet: mock(() => {}),
    renderEffects: mock((...args) => renderEffects(overrides as SkiaRenderer, ...args)),
    drawNodeFill: mock(() => {}),
    drawNodeStroke: mock(() => {}),
    drawStrokeWithAlign: mock(() => {}),
    resolveStrokeColor: mock(() => ({ r: 0, g: 0, b: 0, a: 1 })),
    nodePictureCache: {
      get: mock(() => null),
      set: mock(() => {})
    },
    isRectangularType: mock(() => true),
    worldViewport: { x: 0, y: 0, w: 1000, h: 1000 },
    ...overrides
  } as SkiaRenderer
}

function createMockCanvas() {
  return {
    save: mock(() => {}),
    restore: mock(() => {}),
    translate: mock(() => {}),
    rotate: mock(() => {}),
    scale: mock(() => {}),
    drawOval: mock(() => {}),
    drawRRect: mock(() => {}),
    drawRect: mock(() => {}),
    drawPath: mock(() => {}),
    saveLayer: mock(() => {}),
    clipPath: mock(() => {}),
    clipRRect: mock(() => {}),
    clipRect: mock(() => {}),
    drawPicture: mock(() => {}),
    drawParagraph: mock(() => {})
  }
}

describe('Renderer effect ordering (Behavioral)', () => {
  test('drop shadow renders before fills', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      id: 'node1',
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 0, y: 0 },
          radius: 10,
          spread: 0
        }
      ],
      fills: [{ visible: true, type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1 }],
      strokes: [],
      strokeGeometry: []
    }
    const graph: Partial<SceneGraph> = {
      getNode: mock(() => node as SceneNode)
    }

    const callOrder: string[] = []
    r.renderEffects = mock((_c, _n, _r, _h, pass) => {
      callOrder.push(`renderEffects:${pass}`)
    })
    r.drawNodeFill = mock(() => {
      callOrder.push('drawNodeFill')
    })

    renderShapeUncached(r, canvas as Canvas, node as SceneNode, graph as SceneGraph)

    expect(callOrder).toEqual(['renderEffects:behind', 'drawNodeFill', 'renderEffects:front'])
  })

  test('inner shadow and blur render after strokes', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      id: 'node1',
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [],
      childIds: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 0, y: 0 },
          radius: 10,
          spread: 0
        }
      ],
      strokes: [{ visible: true, weight: 1, opacity: 1 }],
      strokeGeometry: []
    }
    const graph: Partial<SceneGraph> = {
      getNode: mock(() => node as SceneNode)
    }

    const callOrder: string[] = []
    r.renderEffects = mock((_c, _n, _r, _h, pass) => {
      callOrder.push(`renderEffects:${pass}`)
    })
    r.drawStrokeWithAlign = mock(() => {
      callOrder.push('drawStrokeWithAlign')
    })

    renderShapeUncached(r, canvas as Canvas, node as SceneNode, graph as SceneGraph)

    // Strokes are rendered between behind and front effects
    const strokeIdx = callOrder.indexOf('drawStrokeWithAlign')
    const frontIdx = callOrder.indexOf('renderEffects:front')
    expect(strokeIdx).toBeGreaterThan(-1)
    expect(frontIdx).toBeGreaterThan(-1)
    expect(strokeIdx).toBeLessThan(frontIdx)
  })
})

describe('Renderer handles all effect types (Behavioral)', () => {
  test('handles DROP_SHADOW', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [],
      childIds: [],
      strokeGeometry: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ]
    }
    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')
    expect(canvas.drawRect).toHaveBeenCalled()
  })

  test('handles INNER_SHADOW', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [],
      childIds: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ]
    }
    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array([0, 0, 100, 100]),
      false,
      'front'
    )
    expect(canvas.drawPath).toHaveBeenCalled()
  })

  test('handles BACKGROUND_BLUR', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      fills: [],
      childIds: [],
      effects: [{ type: 'BACKGROUND_BLUR', visible: true, radius: 10 }]
    }
    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')
    expect(r.applyClippedBlur).toHaveBeenCalled()
  })

  test('handles LAYER_BLUR in renderNode', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      id: 'n1',
      visible: true,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      effects: [{ type: 'LAYER_BLUR', visible: true, radius: 10 }],
      childIds: []
    }
    const graph: Partial<SceneGraph> = {
      getNode: mock(() => node as SceneNode)
    }
    renderNode(r, canvas as Canvas, graph as SceneGraph, 'n1', {})
    expect(r.getCachedBlur).toHaveBeenCalledWith(5)
    expect(canvas.saveLayer).toHaveBeenCalled()
  })

  test('handles FOREGROUND_BLUR in renderNode', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      id: 'n1',
      visible: true,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      effects: [{ type: 'FOREGROUND_BLUR', visible: true, radius: 20 }],
      childIds: []
    }
    const graph: Partial<SceneGraph> = {
      getNode: mock(() => node as SceneNode)
    }
    renderNode(r, canvas as Canvas, graph as SceneGraph, 'n1', {})
    expect(r.getCachedBlur).toHaveBeenCalledWith(10)
    expect(canvas.saveLayer).toHaveBeenCalled()
  })
})

describe('Shadow spread support (Behavioral)', () => {
  test('drop shadow uses spread for shape expansion', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [{ visible: true, type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1 }],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 4
        }
      ],
      strokeGeometry: []
    }
    const rect = new Float32Array([0, 0, 100, 100])

    renderEffects(r, canvas as Canvas, node as SceneNode, rect, false, 'behind')

    expect(canvas.drawRect).toHaveBeenCalled()
    expect(r.ltrb).toHaveBeenCalledWith(-4, -4, 104, 104)
  })

  test('drop shadow uses makeRRectWithSpread when node has radius', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [{ visible: true, type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1 }],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 4
        }
      ],
      strokeGeometry: []
    }
    const rect = new Float32Array([0, 0, 100, 100])

    renderEffects(r, canvas as Canvas, node as SceneNode, rect, true, 'behind')

    expect(r.makeRRectWithSpread).toHaveBeenCalledWith(node, 4)
    expect(canvas.drawRRect).toHaveBeenCalled()
  })

  test('inner shadow uses spread for cutout contraction', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [],
      childIds: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 4
        }
      ]
    }
    const rect = new Float32Array([0, 0, 100, 100])

    renderEffects(r, canvas as Canvas, node as SceneNode, rect, false, 'front')

    expect(r.ck.LTRBRect).toHaveBeenCalledWith(9, 9, 101, 101)
    expect(canvas.drawPath).toHaveBeenCalled()
  })
})

describe('Text shadow renders on glyphs, not bounding box (Behavioral)', () => {
  test('drop shadow has TEXT-specific branch', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'TEXT',
      width: 100,
      height: 100,
      fills: [],
      childIds: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ]
    }
    const rect = new Float32Array([0, 0, 100, 100])

    renderEffects(r, canvas as Canvas, node as SceneNode, rect, false, 'behind')

    expect(r.getCachedDropShadow).toHaveBeenCalled()
    expect(canvas.saveLayer).toHaveBeenCalled()
    expect(r.renderText).toHaveBeenCalled()
  })

  test('inner shadow has TEXT-specific branch', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'TEXT',
      width: 100,
      height: 100,
      fills: [],
      childIds: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ]
    }
    const rect = new Float32Array([0, 0, 100, 100])

    renderEffects(r, canvas as Canvas, node as SceneNode, rect, false, 'front')

    // 4-layer saveLayer stack: Master, SrcIn/Tint, Blur, DstOut/Punch
    expect(canvas.saveLayer).toHaveBeenCalledTimes(4)
    // renderText called twice: once for mask (step 2), once for punch-out (step 8)
    expect(r.renderText).toHaveBeenCalledTimes(2)
    // Blend modes for the SrcIn and DstOut layers
    expect(r.effectLayerPaint.setBlendMode).toHaveBeenCalledWith(r.ck.BlendMode.SrcIn)
    expect(r.effectLayerPaint.setBlendMode).toHaveBeenCalledWith(r.ck.BlendMode.DstOut)
    // Blur filter for the shadow
    expect(r.getCachedDecalBlur).toHaveBeenCalledTimes(1)
    // Giant rect for (1-M) base
    expect(canvas.drawRect).toHaveBeenCalledTimes(1)
  })

  test('inner shadow detaches ColorFilter from effectLayerPaint before deletion', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'TEXT',
      width: 100,
      height: 100,
      fills: [],
      childIds: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ]
    }
    const rect = new Float32Array([0, 0, 100, 100])

    renderEffects(r, canvas as Canvas, node as SceneNode, rect, false, 'front')

    const calls = r.effectLayerPaint.setColorFilter.mock.calls
    // The final call must be null (exit guard cleans up)
    const lastCall = calls[calls.length - 1]
    expect(lastCall[0]).toBeNull()

    // Every non-null ColorFilter assignment must have a subsequent null detach.
    // This verifies the detach-before-delete pattern for both tintFilter and solidBlackFilter.
    for (let i = 0; i < calls.length; i++) {
      if (calls[i][0] !== null) {
        const hasSubsequentNull = calls.slice(i + 1).some((c) => c[0] === null)
        expect(hasSubsequentNull).toBe(true)
      }
    }
  })
})

describe('Edge cases and bug fixes', () => {
  test('drop shadow cast from stroke when node has no fill', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [{ visible: false, type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1 }],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 0, y: 0 },
          radius: 10,
          spread: 0
        }
      ],
      strokes: [{ visible: true, weight: 2, opacity: 1 }],
      strokeGeometry: [{} as Path]
    }
    r.getStrokeGeometry = mock(() => [{} as Path])

    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')

    expect(r.getStrokeGeometry).toHaveBeenCalledWith(node)
    expect(canvas.drawPath).toHaveBeenCalled()
  })

  test('drop shadow from child applies child transforms (geometric parity)', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const child: Partial<SceneNode> = {
      type: 'RECTANGLE',
      x: 10,
      y: 20,
      width: 50,
      height: 60,
      rotation: 45,
      flipY: true,
      effects: []
    }
    const node: Partial<SceneNode> = {
      type: 'FRAME',
      width: 100,
      height: 100,
      fills: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 5, y: 5 },
          radius: 0,
          spread: 0
        }
      ],
      childIds: ['child1']
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array(4),
      false,
      'behind',
      child as SceneNode
    )

    // Verify order: translate (offset) -> rotate -> translate (flip) -> scale
    const translateCalls = mockCalls(canvas.translate)
    const rotateCalls = mockCalls(canvas.rotate)
    const scaleCalls = mockCalls(canvas.scale)

    expect(translateCalls[0]).toEqual([5 + 10, 5 + 20])
    expect(rotateCalls[0]).toEqual([45, 25, 30])
    expect(translateCalls[1]).toEqual([0, 60])
    expect(scaleCalls[0]).toEqual([1, -1])
    expect(canvas.drawRect).toHaveBeenCalled()
  })

  test('drop shadow from TEXT child renders glyphs (fidelity parity)', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const child: Partial<SceneNode> = {
      type: 'TEXT',
      x: 10,
      y: 20,
      width: 50,
      height: 60,
      text: 'Hello',
      effects: []
    }
    const node: Partial<SceneNode> = {
      type: 'FRAME',
      width: 100,
      height: 100,
      fills: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ],
      childIds: ['child1']
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array(4),
      false,
      'behind',
      child as SceneNode
    )

    expect(r.getCachedDropShadow).toHaveBeenCalled()
    expect(canvas.saveLayer).toHaveBeenCalled()
    expect(canvas.translate).toHaveBeenCalledWith(15, 25)
    expect(r.renderText).toHaveBeenCalledWith(expect.anything(), child)
  })

  test('inner shadow from shape child applies child transforms and rects (geometric parity)', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const child: Partial<SceneNode> = {
      type: 'RECTANGLE',
      x: 10,
      y: 20,
      width: 50,
      height: 60,
      rotation: 45,
      flipY: true,
      effects: []
    }
    const node: Partial<SceneNode> = {
      type: 'FRAME',
      width: 100,
      height: 100,
      fills: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 5, y: 5 },
          radius: 0,
          spread: 0
        }
      ],
      childIds: ['child1']
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array(4),
      false,
      'front',
      child as SceneNode
    )

    const translateCalls = mockCalls(canvas.translate)
    const rotateCalls = mockCalls(canvas.rotate)
    const scaleCalls = mockCalls(canvas.scale)

    expect(translateCalls[0]).toEqual([10, 20])
    expect(rotateCalls[0]).toEqual([45, 25, 30])
    expect(translateCalls[1]).toEqual([0, 60])
    expect(scaleCalls[0]).toEqual([1, -1])
    expect(r.ck.LTRBRect).toHaveBeenCalledWith(0, 0, 50, 60)
    expect(canvas.clipRect).toHaveBeenCalled()
  })

  test('drop shadow from TEXT child applies offset in parent space', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const child: Partial<SceneNode> = {
      type: 'TEXT',
      x: 10,
      y: 20,
      width: 50,
      height: 60,
      text: 'Hello',
      rotation: 45,
      effects: []
    }
    const node: Partial<SceneNode> = {
      type: 'FRAME',
      width: 100,
      height: 100,
      fills: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ],
      childIds: ['child1']
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array(4),
      false,
      'behind',
      child as SceneNode
    )

    const translateCalls = mockCalls(canvas.translate)
    expect(translateCalls[0]).toEqual([15, 25]) // offset + child position

    // The filter should NOT have the offset (neutralized to 0,0)
    expect(r.getCachedDropShadow).toHaveBeenCalledWith(0, 0, 5, expect.anything())
  })

  test('INNER_SHADOW with large offset does not vanish (bounding box union)', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 200, y: 0 },
          radius: 10,
          spread: 0
        }
      ]
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array([0, 0, 100, 100]),
      false,
      'front'
    )

    // Expect LTRBRect for 'big' to encompass both the shape (0 to 100) and the offset hole (200 to 300)
    // with expand (20) padding: min(-20, -20+200) = -20, max(100+20, 100+20+200) = 320
    expect(r.ck.LTRBRect).toHaveBeenCalledWith(
      -20, // min(-expand, -expand + offsetX)
      -20, // min(-expand, -expand + offsetY)
      320, // max(width + expand, width + expand + offsetX)
      120 // max(height + expand, height + expand + offsetY)
    )
    expect(canvas.drawPath).toHaveBeenCalled()
  })

  test('INNER_SHADOW with spread on rounded rect shrinks hole concentrically', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      cornerRadius: 10,
      fills: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 4
        }
      ]
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array([0, 0, 100, 100]),
      true,
      'front'
    )

    // makeRRectWithOffset should receive (node, localOffsetX, localOffsetY, spread)
    // localOffsetX = 5, localOffsetY = 5, spread = 4
    expect(r.makeRRectWithOffset).toHaveBeenCalledWith(node, 5, 5, 4)
  })
})

describe('INNER_SHADOW bug proofs', () => {
  test('INNER_SHADOW solid mask via ColorFilter on DstOut layer', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'TEXT',
      width: 100,
      height: 100,
      fills: [],
      childIds: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 5, y: 5 },
          radius: 0,
          spread: 0
        }
      ]
    }

    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'front')

    // PROOF: ColorFilter.MakeBlend(black, SrcIn) on DstOut layer paint
    // forces renderText output to solid black without mutating fillPaint.
    // The DstOut saveLayer punches the solid mask from the blurred block.
    expect(canvas.saveLayer).toHaveBeenCalled()
    expect(canvas.drawRect).toHaveBeenCalled()
  })
})
