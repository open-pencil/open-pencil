import { mock } from 'bun:test'

import { renderEffects } from '#core/canvas/shadows'
import type { Color, SceneNode } from '#core/scene-graph'

// ─── Utilities ─────────────────────────────────

/** Extract call records from a bun:test mock function. */
export function mockCalls(fn: ReturnType<typeof mock>): unknown[][] {
  return (fn as { mock: { calls: unknown[][] } }).mock.calls
}

// ─── Mock type definitions ──────────────────────────────────────────────

/** Mock CanvasKit Paint — subset of the real Paint API used in rendering */
export interface MockPaint {
  setColor: (_color: Float32Array) => void
  setShader: (_shader: unknown) => void
  setAlphaf: (_alpha: number) => void
  setMaskFilter: (_filter: unknown) => void
  setImageFilter: (_filter: unknown) => void
  setColorFilter: (_filter: unknown) => void
  setBlendMode: (_mode: number) => void
  setStrokeWidth: (_width: number) => void
  setPathEffect: (_effect: unknown) => void
  setStrokeCap: (_cap: number) => void
  setStrokeJoin: (_join: number) => void
  getColor: () => Float32Array
  delete: () => void
}

/** Mock CanvasKit Path — subset of the real Path API */
export interface MockPath {
  addOval: (_oval: Float32Array) => void
  addRect: (_rect: Float32Array) => void
  addRRect: (_rrect: Float32Array) => void
  addPath: (_path: unknown) => void
  op: (_path: unknown, _op: number) => boolean
  transform: (_matrix: Float32Array) => void
  delete: () => void
  copy: () => MockPath
  stroke: () => MockPath
  moveTo: (_x: number, _y: number) => void
  lineTo: (_x: number, _y: number) => void
  cubicTo: (_x1: number, _y1: number, _x2: number, _y2: number, _x3: number, _y3: number) => void
  close: () => void
}

/** Mock renderer — typed subset of SkiaRenderer used by effect rendering tests */
export interface EffectTestRenderer {
  ck: {
    Color4f: (r: number, g: number, b: number, a: number) => Float32Array
    LTRBRect: (l: number, t: number, r: number, b: number) => Float32Array
    RRectXY: (..._args: unknown[]) => Float32Array
    ClipOp: { Intersect: number }
    Path: new () => MockPath
    PathOp: { Difference: number; Union: number }
    BlendMode: { SrcOver: number; SrcIn: number; DstOut: number }
    StrokeJoin: { Round: number }
    Matrix: { translated: (_x: number, _y: number) => Float32Array }
    ColorType: { RGBA_8888: number }
    AlphaType: { Premul: number; Unpremul: number }
    ColorSpace: { SRGB: number }
    TileMode: { Decal: number; Clamp: number; Repeat: number; Mirror: number }
    FilterMode: { Nearest: number; Linear: number }
    MipmapMode: { None: number; Nearest: number; Linear: number }
    BLACK: Float32Array
    WHITE: Float32Array
    TRANSPARENT: Float32Array
    Paint: new () => MockPaint
    ColorFilter: {
      MakeBlend: (..._args: unknown[]) => { delete(): void }
      MakeMatrix: (..._args: unknown[]) => { delete(): void }
    }
  }
  auxFill: MockPaint
  auxStroke: MockPaint
  fillPaint: MockPaint
  strokePaint: MockPaint
  opacityPaint: MockPaint
  effectLayerPaint: MockPaint
  color4f: (r: number, g: number, b: number, a: number) => Float32Array
  ltrb: (l: number, t: number, r: number, b: number) => Float32Array
  getCachedMaskBlur: () => unknown
  getCachedDropShadow: (
    _offX: number,
    _offY: number,
    _radius: number,
    _color?: Float32Array
  ) => unknown
  getCachedDecalBlur: () => unknown
  getCachedBlur: (_radius: number) => unknown
  getStrokeGeometry: (_node: SceneNode) => unknown[] | null
  getFillGeometry: (_node: SceneNode) => unknown | null
  makeRRect: (_rrect: Float32Array) => Float32Array
  makeRRectWithSpread: (_node: SceneNode, _spread: number) => Float32Array
  makeRRectWithOffset: (
    _node: SceneNode,
    _offX: number,
    _offY: number,
    _spread: number
  ) => Float32Array
  renderText: (_canvas: unknown, _node: SceneNode) => void
  applyClippedBlur: (_canvas: unknown, _rect: Float32Array, _mask: unknown) => void
  applyFill: (_canvas: unknown, _color: Float32Array) => boolean
  renderShape: (..._args: unknown[]) => void
  renderSection: (..._args: unknown[]) => void
  renderComponentSet: (..._args: unknown[]) => void
  renderEffects: (..._args: unknown[]) => void
  drawNodeFill: (..._args: unknown[]) => void
  drawNodeStroke: (..._args: unknown[]) => void
  drawStrokeWithAlign: (..._args: unknown[]) => void
  resolveStrokeColor: () => Color
  nodePictureCache: {
    get: () => null
    set: () => void
  }
  isRectangularType: () => boolean
  worldViewport: { x: number; y: number; w: number; h: number }
  makeNodeShapePath: (
    _r: unknown,
    _node: SceneNode,
    _rect: Float32Array,
    _hasRadius: boolean
  ) => MockPath
  makePolygonPath: (_node: SceneNode) => MockPath
  getVectorPaths: (_node: SceneNode) => unknown[] | null
}

/** Minimal graph subset — typed subset of SceneGraph for effect tests */
export interface EffectTestGraph {
  getNode: (_id: string) => SceneNode | null
  images: Map<string, unknown>
}

// ─── Mock factories ──────────────────────────────────────────────────────

export function createMockRenderer(
  overrides: Partial<EffectTestRenderer> = {}
): EffectTestRenderer {
  const r: EffectTestRenderer = {
    ck: {
      Color4f: mock((r: number, g: number, b: number, a: number) => new Float32Array([r, g, b, a])),
      LTRBRect: mock(
        (l: number, t: number, r: number, b: number) => new Float32Array([l, t, r, b])
      ),
      RRectXY: mock((..._args: unknown[]) => new Float32Array(12)),
      ClipOp: { Intersect: 0 },
      Path: class {
        addOval = mock((_oval: Float32Array) => undefined)
        addRect = mock((_rect: Float32Array) => undefined)
        addRRect = mock((_rrect: Float32Array) => undefined)
        addPath = mock((_path: unknown) => undefined)
        op = mock((_path: unknown, _op: number) => true)
        transform = mock((_matrix: Float32Array) => undefined)
        delete = mock(() => undefined)
        copy = mock((): MockPath => this as MockPath)
        stroke = mock((): MockPath => this as MockPath)
        moveTo = mock((_x: number, _y: number) => undefined)
        lineTo = mock((_x: number, _y: number) => undefined)
        cubicTo = mock(
          (_x1: number, _y1: number, _x2: number, _y2: number, _x3: number, _y3: number) =>
            undefined
        )
        close = mock(() => undefined)
      },
      PathOp: { Difference: 0, Union: 1 },
      BlendMode: { SrcOver: 0, SrcIn: 1, DstOut: 2 },
      StrokeJoin: { Round: 0 },
      Matrix: { translated: mock((_x: number, _y: number) => new Float32Array(9)) },
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
        setColor = mock((_color: Float32Array) => undefined)
        setShader = mock((_shader: unknown) => undefined)
        delete = mock(() => undefined)
      },
      ColorFilter: {
        MakeBlend: mock((..._args: unknown[]) => ({ delete: () => undefined })),
        MakeMatrix: mock((..._args: unknown[]) => ({ delete: () => undefined }))
      }
    },
    auxFill: {
      setColor: mock((_color: Float32Array) => undefined),
      setMaskFilter: mock((_filter: unknown) => undefined),
      setImageFilter: mock((_filter: unknown) => undefined),
      setAlphaf: mock((_alpha: number) => undefined),
      setBlendMode: mock((_mode: number) => undefined),
      setShader: mock((_shader: unknown) => undefined),
      delete: mock(() => undefined)
    },
    auxStroke: {
      setStrokeWidth: mock((_width: number) => undefined),
      setColor: mock((_color: Float32Array) => undefined),
      setPathEffect: mock((_effect: unknown) => undefined),
      setAlphaf: mock((_alpha: number) => undefined),
      setBlendMode: mock((_mode: number) => undefined),
      delete: mock(() => undefined)
    },
    fillPaint: {
      setColor: mock((_color: Float32Array) => undefined),
      setAlphaf: mock((_alpha: number) => undefined),
      setShader: mock((_shader: unknown) => undefined),
      getColor: mock(() => new Float32Array([0, 0, 0, 1])),
      setBlendMode: mock((_mode: number) => undefined),
      delete: mock(() => undefined)
    },
    strokePaint: {
      setColor: mock((_color: Float32Array) => undefined),
      setStrokeWidth: mock((_width: number) => undefined),
      setAlphaf: mock((_alpha: number) => undefined),
      setPathEffect: mock((_effect: unknown) => undefined),
      setStrokeCap: mock((_cap: number) => undefined),
      setStrokeJoin: mock((_join: number) => undefined),
      setBlendMode: mock((_mode: number) => undefined),
      delete: mock(() => undefined)
    },
    opacityPaint: {
      setAlphaf: mock((_alpha: number) => undefined),
      setBlendMode: mock((_mode: number) => undefined),
      delete: mock(() => undefined)
    },
    effectLayerPaint: {
      setColor: mock((_color: Float32Array) => undefined),
      setMaskFilter: mock((_filter: unknown) => undefined),
      setImageFilter: mock((_filter: unknown) => undefined),
      setColorFilter: mock((_filter: unknown) => undefined),
      setBlendMode: mock((_mode: number) => undefined),
      delete: mock(() => undefined)
    },
    color4f: mock((r: number, g: number, b: number, a: number) => new Float32Array([r, g, b, a])),
    ltrb: mock((l: number, t: number, r: number, b: number) => new Float32Array([l, t, r, b])),
    getCachedMaskBlur: mock(() => ({})),
    getCachedDropShadow: mock(
      (_offX: number, _offY: number, _radius: number, _color?: Float32Array) => ({})
    ),
    getCachedDecalBlur: mock(() => ({})),
    getCachedBlur: mock((_radius: number) => ({})),
    getStrokeGeometry: mock((_node: SceneNode) => null),
    getFillGeometry: mock((_node: SceneNode) => null),
    getVectorPaths: mock((_node: SceneNode) => null),
    makeRRect: mock((_rrect: Float32Array) => new Float32Array(12)),
    makeRRectWithSpread: mock((_node: SceneNode, _spread: number) => new Float32Array(12)),
    makeRRectWithOffset: mock(
      (_node: SceneNode, _offX: number, _offY: number, _spread: number) => new Float32Array(12)
    ),
    renderText: mock((_canvas: unknown, _node: SceneNode) => undefined),
    applyClippedBlur: mock((_canvas: unknown, _rect: Float32Array, _mask: unknown) => undefined),
    applyFill: mock((_canvas: unknown, _color: Float32Array) => true),
    renderShape: mock((..._args: unknown[]) => undefined),
    renderSection: mock((..._args: unknown[]) => undefined),
    renderComponentSet: mock((..._args: unknown[]) => undefined),
    // Delegate to real renderEffects so saveLayer/mask pipelines execute
    renderEffects: (...args: unknown[]) => renderEffects(r, ...args),
    drawNodeFill: mock((..._args: unknown[]) => undefined),
    drawNodeStroke: mock((..._args: unknown[]) => undefined),
    drawStrokeWithAlign: mock((..._args: unknown[]) => undefined),
    resolveStrokeColor: mock(() => ({ r: 0, g: 0, b: 0, a: 1 })),
    nodePictureCache: {
      get: mock(() => null),
      set: mock(() => undefined)
    },
    isRectangularType: mock(() => true),
    makeNodeShapePath: mock(() => new r.ck.Path()),
    makePolygonPath: mock(() => new r.ck.Path()),
    worldViewport: { x: 0, y: 0, w: 1000, h: 1000 },
    ...overrides
  }

  return r
}

export function createMockCanvas(): ReturnType<typeof createMockCanvas> {
  return {
    save: mock(() => undefined),
    restore: mock(() => undefined),
    translate: mock((_x: number, _y: number) => undefined),
    rotate: mock((_degrees: number, _px: number, _py: number) => undefined),
    scale: mock((_sx: number, _sy: number) => undefined),
    drawOval: mock((_oval: Float32Array) => undefined),
    drawRRect: mock((_rrect: Float32Array) => undefined),
    drawRect: mock((_rect: Float32Array) => undefined),
    drawPath: mock((_path: unknown) => undefined),
    saveLayer: mock((_paint?: unknown, _bounds?: Float32Array) => undefined),
    clipPath: mock((_path: unknown, _op?: number) => undefined),
    clipRRect: mock((_rrect: Float32Array, _op?: number) => undefined),
    clipRect: mock((_rect: Float32Array, _op?: number) => undefined),
    drawPicture: mock((_picture: unknown) => undefined),
    drawParagraph: mock((_paragraph: unknown) => undefined),
    getSaveCount: mock(() => 0)
  }
}

/** Re-export for convenience */
export { renderEffects } from '#core/canvas/shadows'
export { renderNode, renderShapeUncached } from '#core/canvas/scene'
