import { expect, mock, test } from 'bun:test'

import type { Canvas, Image as CKImage, ImageInfo, Surface } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { renderSceneBacking } from '#core/canvas/renderer/retained-backing'

function createRenderer(surfaceFactory: (info: ImageInfo) => Surface | null) {
  const renderer: Partial<SkiaRenderer> = {
    ck: {
      AlphaType: { Premul: 'Premul' },
      ColorSpace: { SRGB: 'SRGB' },
      ColorType: { RGBA_8888: 'RGBA_8888' },
      Color4f: mock((r: number, g: number, b: number, a: number) => [r, g, b, a]),
      LTRBRect: mock((left: number, top: number, right: number, bottom: number) => [
        left,
        top,
        right,
        bottom
      ]),
      FilterMode: { Linear: 'Linear' },
      MipmapMode: { None: 'None' }
    } as SkiaRenderer['ck'],
    surface: {
      makeSurface: mock(surfaceFactory)
    } as SkiaRenderer['surface'],
    opacityPaint: {
      setAlphaf: mock()
    } as SkiaRenderer['opacityPaint'],
    panX: 0,
    panY: 0,
    zoom: 1,
    dpr: 1,
    maxTextureSize: 16384,
    viewportWidth: 100,
    viewportHeight: 100,
    pageColor: { r: 1, g: 1, b: 1 },
    pageId: 'page',
    sceneBacking: null,
    sceneBackingBuild: null,
    sceneBackingNeedsCrispRender: false,
    sceneBackingPreviewUntil: 0,
    sceneBackingAverageRecordMs: 40,
    sceneBackingAverageViewportIntervalMs: 80,
    scenePictureVersion: 0,
    scenePicturePositionPreviewVersion: 0,
    scenePicturePageId: null,
    subtreePictureCache: new Map(),
    subtreePictureCachePageId: null,
    subtreePictureCacheSceneVersion: 0,
    subtreePictureCachePositionPreviewVersion: 0,
    worldViewport: { x: 0, y: 0, w: 0, h: 0 },
    renderNode: mock()
  }
  return renderer as SkiaRenderer
}

function createCanvas() {
  const canvas: Partial<Canvas> = {
    drawImageRect: mock(),
    drawImageRectOptions: mock()
  }
  return canvas as Canvas
}

function createGraph(positionPreviewVersion = 0) {
  const graph: Partial<SceneGraph> = {
    rootId: 'root',
    positionPreviewVersion,
    getNode: mock((id: string) => {
      if (id === 'page') return { id: 'page', type: 'CANVAS', childIds: [] }
      return null
    }),
    getAbsolutePosition: mock(() => ({ x: 0, y: 0 }))
  }
  return graph as SceneGraph
}

test('retained scene backing falls back when CanvasKit cannot create an offscreen surface', () => {
  const r = createRenderer(() => null)
  const canvas = createCanvas()
  const graph = createGraph()

  expect(renderSceneBacking(r, canvas, graph, 1)).toBe(false)
  expect(r.surface.makeSurface).toHaveBeenCalled()
  expect(canvas.drawImageRectOptions).not.toHaveBeenCalled()
  expect(r.sceneBacking).toBeNull()
})

test('retained scene backing filters cross-zoom previews instead of falling back to live rendering', () => {
  const r = createRenderer(() => null)
  r.zoom = 1
  r.sceneBackingPreviewUntil = Number.POSITIVE_INFINITY
  r.sceneBacking = {
    image: { delete: mock() } as CKImage,
    pageId: 'page',
    sceneVersion: 1,
    positionPreviewVersion: 0,
    panX: 0,
    panY: 0,
    zoom: 0.5,
    width: 300,
    height: 300,
    dpr: 1,
    worldX: 0,
    worldY: 0,
    worldWidth: 600,
    worldHeight: 600
  } as NonNullable<SkiaRenderer['sceneBacking']>
  const canvas = createCanvas()
  const graph = createGraph()

  expect(renderSceneBacking(r, canvas, graph, 1)).toBe(true)
  expect(canvas.drawImageRectOptions).toHaveBeenCalledWith(
    r.sceneBacking.image,
    expect.anything(),
    expect.anything(),
    r.ck.FilterMode.Linear,
    r.ck.MipmapMode.None,
    r.opacityPaint
  )
})

test('retained scene backing allows same-zoom previews while panning', () => {
  const r = createRenderer(() => null)
  r.zoom = 1
  r.sceneBackingPreviewUntil = Number.POSITIVE_INFINITY
  r.sceneBacking = {
    image: { delete: mock() } as CKImage,
    pageId: 'page',
    sceneVersion: 1,
    positionPreviewVersion: 0,
    panX: 0,
    panY: 0,
    zoom: 1,
    width: 300,
    height: 300,
    dpr: 1,
    worldX: 0,
    worldY: 0,
    worldWidth: 300,
    worldHeight: 300
  } as NonNullable<SkiaRenderer['sceneBacking']>
  const canvas = createCanvas()
  const graph = createGraph()

  expect(renderSceneBacking(r, canvas, graph, 1)).toBe(true)
  expect(canvas.drawImageRectOptions).toHaveBeenCalled()
})

test('retained scene backing keeps the offscreen surface within the GPU texture limit', () => {
  // Regression: a wide viewport on a HiDPI display asked for a backing texture
  // larger than MAX_TEXTURE_SIZE, so the allocation failed and the canvas went
  // blank. Reproduces the reported case: 2998x1490 CSS px at dpr 2, where the
  // unclamped 3x margin would request ceil(2998*3)*2 = 17988 px of width.
  const requested: Array<{ width: number; height: number }> = []
  const r = createRenderer((info) => {
    requested.push({ width: info.width, height: info.height })
    return null
  })
  r.dpr = 2
  r.maxTextureSize = 16384
  r.viewportWidth = 2998
  r.viewportHeight = 1490

  renderSceneBacking(r, createCanvas(), createGraph(), 1)

  expect(requested).not.toHaveLength(0)
  for (const size of requested) {
    expect(size.width).toBeLessThanOrEqual(r.maxTextureSize)
    expect(size.height).toBeLessThanOrEqual(r.maxTextureSize)
  }
})

test('retained scene backing does not shrink the margin when it already fits', () => {
  const requested: Array<{ width: number; height: number }> = []
  const r = createRenderer((info) => {
    requested.push({ width: info.width, height: info.height })
    return null
  })
  r.dpr = 2
  r.maxTextureSize = 16384
  r.viewportWidth = 1919
  r.viewportHeight = 1490

  renderSceneBacking(r, createCanvas(), createGraph(), 1)

  // 1919 * 3 * 2 = 11514, comfortably inside the limit, so the full
  // SCENE_BACKING_SCALE margin must be preserved.
  expect(requested[0]).toEqual({ width: 11514, height: 8940 })
})

test('retained scene backing survives CanvasKit throwing instead of returning null', () => {
  // CanvasKit raises "Cannot set properties of null" rather than returning null
  // when it cannot allocate; the null-guard alone did not stop that from
  // escaping as an uncaught TypeError.
  const r = createRenderer(() => {
    throw new TypeError("Cannot set properties of null (setting 'be')")
  })
  const canvas = createCanvas()

  expect(() => renderSceneBacking(r, canvas, createGraph(), 1)).not.toThrow()
  expect(r.sceneBacking).toBeNull()
  expect(canvas.drawImageRectOptions).not.toHaveBeenCalled()
})

test('retained scene backing invalidates stale position-preview metadata', () => {
  const r = createRenderer(() => null)
  r.sceneBacking = {
    image: { delete: mock() } as CKImage,
    pageId: 'page',
    sceneVersion: 1,
    positionPreviewVersion: 1,
    panX: 0,
    panY: 0,
    zoom: 1,
    width: 100,
    height: 100,
    dpr: 1,
    worldX: 0,
    worldY: 0,
    worldWidth: 100,
    worldHeight: 100
  } as NonNullable<SkiaRenderer['sceneBacking']>
  r.scenePicturePositionPreviewVersion = 1
  const canvas = createCanvas()
  const graph = createGraph(2)

  expect(renderSceneBacking(r, canvas, graph, 1)).toBe(false)
  expect(canvas.drawImageRectOptions).not.toHaveBeenCalled()
})
