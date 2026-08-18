import { mock } from 'bun:test'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { renderEffects } from '#core/canvas/shadows'

export function mockCalls(fn: ReturnType<typeof mock>): unknown[][] {
  return (fn as { mock: { calls: unknown[][] } }).mock.calls
}

export function createMockRenderer(overrides: Partial<SkiaRenderer> = {}): SkiaRenderer {
  class MockPath {
    delete = mock(() => undefined)
    copy = mock(() => new MockPath())
    makeCombined = mock(() => new MockPath())
    makeStroked = mock(() => new MockPath())
  }

  return {
    ck: {
      Color4f: mock((r, g, b, a) => new Float32Array([r, g, b, a])),
      LTRBRect: mock((l, t, r, b) => new Float32Array([l, t, r, b])),
      RRectXY: mock(() => new Float32Array(12)),
      ClipOp: { Intersect: 0 },
      Path: Object.assign(MockPath, {
        MakeFromOp: mock(() => new MockPath())
      }),
      PathBuilder: class {
        addOval = mock(() => this)
        addRect = mock(() => this)
        addRRect = mock(() => this)
        addPath = mock(() => this)
        transform = mock(() => this)
        delete = mock(() => undefined)
        moveTo = mock(() => this)
        lineTo = mock(() => this)
        cubicTo = mock(() => this)
        close = mock(() => this)
        detachAndDelete = mock(() => new MockPath())
      },
      PathOp: { Difference: 0, Union: 1 },
      StrokeCap: { Butt: 0, Round: 1, Square: 2 },
      StrokeJoin: { Miter: 0, Round: 1, Bevel: 2 },
      Matrix: { translated: mock(() => new Float32Array(9)) },
      BlendMode: { SrcOver: 0, SrcIn: 1, DstOut: 2, Screen: 3, Multiply: 4 },
      PaintStyle: { Fill: 0, Stroke: 1 },
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
        setAntiAlias = mock(() => undefined)
        setColor = mock(() => undefined)
        setShader = mock(() => undefined)
        setStyle = mock(() => undefined)
        delete = mock(() => undefined)
      },
      ColorFilter: {
        MakeBlend: mock(() => ({ delete: () => undefined })),
        MakeMatrix: mock(() => ({ delete: () => undefined }))
      }
    },
    auxFill: {
      setColor: mock(() => undefined),
      setMaskFilter: mock(() => undefined),
      setImageFilter: mock(() => undefined),
      setAlphaf: mock(() => undefined),
      setBlendMode: mock(() => undefined),
      setShader: mock(() => undefined),
      delete: mock(() => undefined)
    },
    auxStroke: {
      setStrokeWidth: mock(() => undefined),
      setColor: mock(() => undefined),
      setPathEffect: mock(() => undefined),
      setAlphaf: mock(() => undefined),
      setBlendMode: mock(() => undefined),
      delete: mock(() => undefined)
    },
    fillPaint: {
      setColor: mock(() => undefined),
      setAlphaf: mock(() => undefined),
      setShader: mock(() => undefined),
      getColor: mock(() => new Float32Array([0, 0, 0, 1])),
      setBlendMode: mock(() => undefined),
      delete: mock(() => undefined)
    },
    strokePaint: {
      setColor: mock(() => undefined),
      setStrokeWidth: mock(() => undefined),
      setAlphaf: mock(() => undefined),
      setPathEffect: mock(() => undefined),
      setStrokeCap: mock(() => undefined),
      setStrokeJoin: mock(() => undefined),
      setStrokeMiter: mock(() => undefined),
      setBlendMode: mock(() => undefined),
      delete: mock(() => undefined)
    },
    opacityPaint: {
      setAlphaf: mock(() => undefined),
      setBlendMode: mock(() => undefined),
      delete: mock(() => undefined)
    },
    effectLayerPaint: {
      setColor: mock(() => undefined),
      setMaskFilter: mock(() => undefined),
      setImageFilter: mock(() => undefined),
      setColorFilter: mock(() => undefined),
      setBlendMode: mock(() => undefined),
      delete: mock(() => undefined)
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
    makePolygonPath: mock(function (this: SkiaRenderer) {
      return new this.ck.Path()
    }),
    renderText: mock(() => undefined),
    applyClippedBlur: mock(() => undefined),
    clipNodeShape: mock(() => undefined),
    applyFill: mock(() => true),
    renderShape: mock(() => undefined),
    renderSection: mock(() => undefined),
    renderComponentSet: mock(() => undefined),
    renderEffects: mock((...args) => renderEffects(overrides as SkiaRenderer, ...args)),
    drawNodeFill: mock(() => undefined),
    drawNodeStroke: mock(() => undefined),
    drawStrokeWithAlign: mock(() => undefined),
    resolveStrokeColor: mock(() => ({ r: 0, g: 0, b: 0, a: 1 })),
    nodePictureCache: {
      get: mock(() => null),
      set: mock(() => undefined)
    },
    isRectangularType: mock(() => true),
    worldViewport: { x: 0, y: 0, w: 1000, h: 1000 },
    ...overrides
  } as SkiaRenderer
}

export function createMockCanvas() {
  return {
    save: mock(() => undefined),
    restore: mock(() => undefined),
    translate: mock(() => undefined),
    rotate: mock(() => undefined),
    scale: mock(() => undefined),
    drawOval: mock(() => undefined),
    drawRRect: mock(() => undefined),
    drawCircle: mock(() => undefined),
    drawRect: mock(() => undefined),
    drawPath: mock(() => undefined),
    saveLayer: mock(() => undefined),
    clipPath: mock(() => undefined),
    clipRRect: mock(() => undefined),
    clipRect: mock(() => undefined),
    drawPicture: mock(() => undefined),
    drawParagraph: mock(() => undefined)
  }
}
