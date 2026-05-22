import { mock } from 'bun:test'

import type { SkiaRenderer } from '#core/canvas/renderer'
import type { SceneGraph } from '#core/scene-graph'

// ─── Utilities ─────────────────────────────────

/** Extract call records from a bun:test mock function. */
export function mockCalls(fn: ReturnType<typeof mock>): unknown[][] {
  return (fn as { mock: { calls: unknown[][] } }).mock.calls
}

// ─── Paint ─────────────────────────────────────

export function createMockPaint(overrides: Record<string, unknown> = {}) {
  return {
    setShader: mock(() => undefined),
    setAlphaf: mock(() => undefined),
    setColor: mock(() => undefined),
    setStrokeWidth: mock(() => undefined),
    setStrokeCap: mock(() => undefined),
    setStrokeJoin: mock(() => undefined),
    setPathEffect: mock(() => undefined),
    setMaskFilter: mock(() => undefined),
    setImageFilter: mock(() => undefined),
    setColorFilter: mock(() => undefined),
    setBlendMode: mock(() => undefined),
    getColor: mock(() => new Float32Array([0, 0, 0, 1])),
    delete: mock(() => undefined),
    ...overrides
  }
}

// ─── Canvas ────────────────────────────────────

export function createMockCanvas(overrides: Record<string, unknown> = {}) {
  return {
    save: mock(() => undefined),
    restore: mock(() => undefined),
    saveLayer: mock(() => undefined),
    translate: mock(() => undefined),
    rotate: mock(() => undefined),
    scale: mock(() => undefined),
    clipRect: mock(() => undefined),
    clipRRect: mock(() => undefined),
    clipPath: mock(() => undefined),
    drawRect: mock(() => undefined),
    drawRRect: mock(() => undefined),
    drawPath: mock(() => undefined),
    drawLine: mock(() => undefined),
    drawArc: mock(() => undefined),
    drawPicture: mock(() => undefined),
    drawParagraph: mock(() => undefined),
    drawText: mock(() => undefined),
    drawOval: mock(() => undefined),
    ...overrides
  }
}

/** Canvas mock that tracks save/restore depth for leak assertions. */
export function createSaveTrackingCanvas(overrides: Record<string, unknown> = {}) {
  let saveDepth = 0
  const tracked: Record<string, unknown> = {
    save: () => {
      saveDepth++
    },
    restore: () => {
      saveDepth--
    },
    saveLayer: () => {
      saveDepth++
    }
  }
  const canvas = createMockCanvas({ ...overrides, ...tracked })
  return { canvas, getSaveDepth: () => saveDepth }
}

// ─── LRU cache ─────────────────────────────────

export function createMockLRU() {
  return {
    get: mock(() => null),
    set: mock(() => undefined),
    delete: mock(() => undefined),
    clear: mock(() => undefined),
    has: mock(() => false),
    values: mock(() => [][Symbol.iterator]()),
    size: 0
  }
}

// ─── WASM alloc/dealloc tracker ────────────────

export interface WasmTracker {
  allocated: number
  deleted: number
}

export function makeWasmTracker(): { tracker: WasmTracker; trackedDelete: () => void } {
  const tracker: WasmTracker = { allocated: 0, deleted: 0 }
  return {
    tracker,
    trackedDelete: () => {
      tracker.deleted++
    }
  }
}

// ─── Path mock ─────────────────────────────────

/** Default CanvasKit Path mock — stroke() returns null (failure). */
export class MockPath {
  delete = mock(() => undefined)
  copy = mock(function (this: MockPath) {
    return this
  })
  stroke = mock(() => null)
  moveTo = mock(() => undefined)
  lineTo = mock(() => undefined)
  cubicTo = mock(() => undefined)
  close = mock(() => undefined)
  addPath = mock(() => undefined)
  addOval = mock(() => undefined)
  addRect = mock(() => undefined)
  addRRect = mock(() => undefined)
  op = mock(() => undefined)
}

/** CanvasKit Path mock where stroke() returns this (success, matching real CK behavior). */
export class MockPathStrokeSuccess extends MockPath {
  override stroke = mock(function (this: MockPathStrokeSuccess) {
    return this
  })
}

// ─── SkiaRenderer ──────────────────────────────

export function createMockRenderer(overrides: Partial<SkiaRenderer> = {}): SkiaRenderer {
  return {
    fillPaint: createMockPaint() as SkiaRenderer['fillPaint'],
    strokePaint: createMockPaint() as SkiaRenderer['strokePaint'],
    auxFill: createMockPaint() as SkiaRenderer['auxFill'],
    auxStroke: createMockPaint() as SkiaRenderer['auxStroke'],
    opacityPaint: createMockPaint() as SkiaRenderer['opacityPaint'],
    effectLayerPaint: createMockPaint() as SkiaRenderer['effectLayerPaint'],
    selectionPaint: createMockPaint() as SkiaRenderer['selectionPaint'],
    parentOutlinePaint: createMockPaint() as SkiaRenderer['parentOutlinePaint'],
    parentOutlineDashEffect: {
      delete: mock(() => undefined)
    } as SkiaRenderer['parentOutlineDashEffect'],
    snapPaint: createMockPaint() as SkiaRenderer['snapPaint'],
    rulerBgPaint: createMockPaint() as SkiaRenderer['rulerBgPaint'],
    rulerTickPaint: createMockPaint() as SkiaRenderer['rulerTickPaint'],
    rulerTextPaint: createMockPaint() as SkiaRenderer['rulerTextPaint'],
    rulerHlPaint: createMockPaint() as SkiaRenderer['rulerHlPaint'],
    rulerBadgePaint: createMockPaint() as SkiaRenderer['rulerBadgePaint'],
    rulerLabelPaint: createMockPaint() as SkiaRenderer['rulerLabelPaint'],
    penPathPaint: createMockPaint() as SkiaRenderer['penPathPaint'],
    penLiveStrokePaint: createMockPaint() as SkiaRenderer['penLiveStrokePaint'],
    penHandlePaint: createMockPaint() as SkiaRenderer['penHandlePaint'],
    penVertexFill: createMockPaint() as SkiaRenderer['penVertexFill'],
    penVertexStroke: createMockPaint() as SkiaRenderer['penVertexStroke'],
    ck: {
      Color4f: mock((r: number, g: number, b: number, a: number) => new Float32Array([r, g, b, a])),
      LTRBRect: mock(
        (l: number, t: number, r: number, b: number) => new Float32Array([l, t, r, b])
      ),
      RRectXY: mock(() => new Float32Array(12)),
      ClipOp: { Intersect: 0 },
      Path: MockPath,
      PathOp: { Difference: 0 },
      BlendMode: { SrcOver: 0, SrcIn: 1, DstOut: 2 },
      ColorType: { RGBA_8888: 0 },
      AlphaType: { Premul: 0, Unpremul: 1 },
      ColorSpace: { SRGB: 0 },
      TileMode: { Decal: 0, Clamp: 1, Repeat: 2, Mirror: 3 },
      FilterMode: { Nearest: 0, Linear: 1 },
      MipmapMode: { None: 0, Nearest: 1, Linear: 2 },
      PathEffect: {
        MakeDash: mock(() => ({ delete: mock(() => undefined) }))
      },
      MakePicture: mock(() => null),
      ColorFilter: {
        MakeBlend: mock(() => ({ delete: mock(() => undefined) })),
        MakeMatrix: mock(() => ({ delete: mock(() => undefined) }))
      },
      BLACK: new Float32Array([0, 0, 0, 1]),
      WHITE: new Float32Array([1, 1, 1, 1]),
      TRANSPARENT: new Float32Array([0, 0, 0, 0]),
      Paint: class {
        setColor = mock(() => undefined)
        setShader = mock(() => undefined)
        delete = mock(() => undefined)
      },
      StrokeCap: { Butt: 'butt', Round: 'round', Square: 'square' },
      StrokeJoin: { Bevel: 'bevel', Miter: 'miter', Round: 'round' }
    } as SkiaRenderer['ck'],
    zoom: 1,
    dpr: 1,
    panX: 0,
    panY: 0,
    viewportWidth: 800,
    viewportHeight: 600,
    showRulers: false,
    worldViewport: { x: 0, y: 0, w: 1000, h: 1000 },
    minScreenSize: 0,
    minScreenSizeForEffects: 0,
    minScreenSizeForText: 0,
    adaptiveMinScreenSize: 0,
    _isViewportAnimating: false,
    _adaptiveLodBoost: 4,
    _adaptiveLodRestoreMs: 200,
    _animationStopTime: 0,
    _scenePictureAnimating: false,
    _prevPanX: null,
    _prevPanY: null,
    _prevZoom: null,
    _effectLodCulledCount: 0,
    _textLodCulledCount: 0,
    _nodeCount: 0,
    _culledCount: 0,
    _lodCulledCount: 0,
    _currentAbsInfo: null,
    _absPosFullCache: new Map(),
    _absPosFullSceneVersion: -1,
    _absPosFullPageId: null,
    _cachedLargeGraphVersion: -1,
    _cachedLargeGraphResult: false,
    _cachedLargeGraphPageId: null,
    fontsLoaded: false,
    fontProvider: null,
    textFont: null,
    fontMgr: null,
    labelFont: null,
    sizeFont: null,
    sectionTitleFont: null,
    componentLabelFont: null,
    pageColor: { r: 0.96, g: 0.96, b: 0.96, a: 1 },
    pageId: null,
    destroyed: false,
    DEFAULT_FONT_SIZE: 16,
    COMPONENT_SET_BORDER_WIDTH: 1,
    COMPONENT_SET_DASH: 4,
    COMPONENT_SET_DASH_GAP: 4,
    imageFilterCache: createMockLRU() as SkiaRenderer['imageFilterCache'],
    maskFilterCache: createMockLRU() as SkiaRenderer['maskFilterCache'],
    imageCache: createMockLRU() as SkiaRenderer['imageCache'],
    vectorPathCache: createMockLRU() as SkiaRenderer['vectorPathCache'],
    vectorStrokePathCache: createMockLRU() as SkiaRenderer['vectorStrokePathCache'],
    vectorStrokeOutlineCache: createMockLRU() as SkiaRenderer['vectorStrokeOutlineCache'],
    fillGeometryCache: createMockLRU() as SkiaRenderer['fillGeometryCache'],
    strokeGeometryCache: createMockLRU() as SkiaRenderer['strokeGeometryCache'],
    nodePictureCache: createMockLRU() as SkiaRenderer['nodePictureCache'],
    shaderCache: createMockLRU() as SkiaRenderer['shaderCache'],
    scenePicture: null,
    scenePictureVersion: -1,
    scenePicturePositionPreviewVersion: -1,
    scenePicturePageId: null,
    sceneBacking: null,
    sceneBackingBuild: null,
    subtreePictureCache: new Map(),
    subtreePictureCachePageId: null,
    subtreePictureCacheSceneVersion: -1,
    subtreePictureCachePositionPreviewVersion: -1,
    labelCache: { update: mock(() => undefined) } as never,
    lastObservedSceneVersion: -1,
    lastSceneVersionChangeAt: 0,
    _flashes: [],
    _aiActiveNodes: new Set(),
    _aiDoneFlashes: [],
    _flashPaint: null,
    isComponentType: mock(() => false),
    isRectangularType: mock(() => true),
    selColor: mock(() => new Float32Array([0, 0, 1, 1])),
    compColor: mock(() => new Float32Array([0.6, 0.3, 1, 1])),
    color4f: mock((r: number, g: number, b: number, a: number) => new Float32Array([r, g, b, a])),
    ltrb: mock((l: number, t: number, r: number, b: number) => new Float32Array([l, t, r, b])),
    effectOverflow: mock(() => 0),
    makeRRect: mock(() => new Float32Array(12)),
    makeRRectWithSpread: mock(() => new Float32Array(12)),
    makeRRectWithOffset: mock(() => new Float32Array(12)),
    makeNodeShapePath: mock(() => ({ delete: mock(() => undefined) })),
    makePolygonPath: mock(() => ({ delete: mock(() => undefined) })),
    clipNodeShape: mock(() => undefined),
    drawNodeFill: mock(() => undefined),
    renderEffects: mock(() => undefined),
    renderText: mock(() => undefined),
    renderShape: mock(() => undefined),
    renderShapeUncached: mock(() => undefined),
    renderNode: mock(() => undefined),
    renderSection: mock(() => undefined),
    renderComponentSet: mock(() => undefined),
    drawNodeStroke: mock(() => undefined),
    drawStrokeWithAlign: mock(() => undefined),
    drawRRectStrokeWithAlign: mock(() => undefined),
    drawIndividualSideStrokes: mock(() => undefined),
    strokeNodeShape: mock(() => undefined),
    getVectorPaths: mock(() => null),
    getFillGeometry: mock(() => null),
    getStrokeGeometry: mock(() => null),
    getCachedDropShadow: mock(() => ({})),
    getCachedBlur: mock(() => null),
    getCachedDecalBlur: mock(() => null),
    getCachedMaskBlur: mock(() => null),
    applyClippedBlur: mock(() => undefined),
    applyFill: mock(() => true),
    applyGradientFill: mock(() => undefined),
    applyImageFill: mock(() => false),
    drawArc: mock(() => undefined),
    drawHoverHighlight: mock(() => undefined),
    drawEnteredContainer: mock(() => undefined),
    drawSelection: mock(() => undefined),
    drawNodeSelection: mock(() => undefined),
    drawSelectionLabels: mock(() => undefined),
    drawParentFrameOutlines: mock(() => undefined),
    drawNodeOutline: mock(() => undefined),
    drawGroupBounds: mock(() => undefined),
    getRotatedCorners: mock(() => []),
    drawHandle: mock(() => undefined),
    drawSnapGuides: mock(() => undefined),
    drawMarquee: mock(() => undefined),
    drawFlashes: mock(() => undefined),
    drawLayoutInsertIndicator: mock(() => undefined),
    drawTextEditOverlay: mock(() => undefined),
    drawNodeEditOverlay: mock(() => undefined),
    drawPenOverlay: mock(() => undefined),
    drawRemoteCursors: mock(() => undefined),
    drawRulers: mock(() => undefined),
    drawSectionTitles: mock(() => undefined),
    drawComponentLabels: mock(() => undefined),
    resolveFillColor: mock(() => ({ r: 0, g: 0, b: 0, a: 1 })),
    resolveStrokeColor: mock(() => ({ r: 0, g: 0, b: 0, a: 1 })),
    resolveFillColorInfo: mock(() => ({ color: { r: 0, g: 0, b: 0, a: 1 }, variableId: null })),
    resolveStrokeColorInfo: mock(() => ({ color: { r: 0, g: 0, b: 0, a: 1 }, variableId: null })),
    buildParagraph: mock(() => ({
      delete: mock(() => undefined),
      layout: mock(() => undefined),
      getLongestLine: mock(() => 0),
      getHeight: mock(() => 0)
    })),
    isNodeFontLoaded: mock(() => true),
    buildTextPicture: mock(() => null),
    measureTextNode: mock(() => null),
    screenToCanvas: mock(() => ({ x: 0, y: 0 })),
    invalidateScenePicture: mock(() => undefined),
    invalidateAllPictures: mock(() => undefined),
    invalidateNodePicture: mock(() => undefined),
    flashNode: mock(() => undefined),
    aiMarkActive: mock(() => undefined),
    aiMarkDone: mock(() => undefined),
    aiFlashDone: mock(() => undefined),
    aiClearActive: mock(() => undefined),
    aiClearAll: mock(() => undefined),
    getFontProvider: mock(() => null),
    isDestroyed: mock(() => false),
    destroy: mock(() => undefined),
    profiler: { destroy: mock(() => undefined) } as never,
    surface: { delete: mock(() => undefined) } as never,
    replaceSurface: mock(() => undefined),
    renderSceneToCanvas: mock(() => undefined),
    renderFromEditorState: mock(() => undefined),
    render: mock(() => undefined),
    invalidateVectorPath: mock(() => undefined),
    prepareForExport: mock(() => Promise.resolve(() => undefined)),
    loadFonts: mock(() => Promise.resolve()),
    hasActiveFlashes: false,
    hitTestSectionTitle: mock(() => null),
    hitTestComponentLabel: mock(() => null),
    hitTestFrameTitle: mock(() => null),
    imageFillShader: null,
    requestRepaint: undefined,
    ...overrides
  } as SkiaRenderer
}

// ─── SceneGraph ────────────────────────────────

export function createMockGraph(): SceneGraph {
  return {
    getNode: mock(() => null),
    rootId: 'root',
    getPages: mock(() => [{ id: 'page-1', name: 'Page 1' }]),
    nodes: new Map(),
    images: new Map(),
    documentColorSpace: 'srgb',
    positionPreviewVersion: 0,
    resolveColorVariable: mock(() => null),
    getAbsolutePosition: mock(() => null),
    countDescendants: mock(() => 0),
    copyProp: mock(() => null),
    emit: mock(() => null),
    on: mock(() => () => undefined),
    off: mock(() => undefined)
  } as SceneGraph
}
