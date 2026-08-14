import { expect, mock, spyOn, test } from 'bun:test'

import type { Canvas, Image as CKImage, ImageInfo, Surface } from 'canvaskit-wasm'

import { getAbsolutePositionFull, SceneGraph } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import {
  computeRetainedSubtreeBounds,
  renderSceneBacking
} from '#core/canvas/renderer/retained-backing'

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
    viewportWidth: 100,
    viewportHeight: 100,
    pageColor: { r: 1, g: 1, b: 1 },
    pageId: 'page',
    sceneBacking: null,
    sceneBackingBuild: null,
    sceneBackingAllocationFailed: false,
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

test('retained subtree bounds include descendants transformed by rotated ancestors', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  if (!page) throw new Error('Expected the default page')
  const parent = graph.createNode('INSTANCE', page.id, {
    x: 100,
    y: 100,
    width: 100,
    height: 100,
    rotation: 90
  })
  const child = graph.createNode('VECTOR', parent.id, {
    x: 1000,
    y: 0,
    width: 100,
    height: 10
  })

  const exact = getAbsolutePositionFull(child, graph)
  const bounds = computeRetainedSubtreeBounds(graph, parent.id)

  if (!bounds) throw new Error('Expected retained subtree bounds')
  expect(bounds.minX).toBeLessThanOrEqual(exact.boundX)
  expect(bounds.minY).toBeLessThanOrEqual(exact.boundY)
  expect(bounds.maxX).toBeGreaterThanOrEqual(exact.boundX + exact.width)
  expect(bounds.maxY).toBeGreaterThanOrEqual(exact.boundY + exact.height)
})

test('retained subtree bounds rotate directional effect overflow into world space', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  if (!page) throw new Error('Expected the default page')
  const node = graph.createNode('RECTANGLE', page.id, {
    x: 100,
    y: 100,
    width: 100,
    height: 50,
    rotation: 90,
    effects: [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 1 },
        offset: { x: 20, y: 0 },
        radius: 0,
        spread: 0,
        visible: true
      }
    ]
  })

  const base = getAbsolutePositionFull(node, graph)
  const bounds = computeRetainedSubtreeBounds(graph, node.id)

  if (!bounds) throw new Error('Expected retained subtree bounds')
  expect(bounds.maxY).toBeCloseTo(base.boundY + base.height + 20)
})

test('retained scene backing falls back when CanvasKit cannot create an offscreen surface', () => {
  const r = createRenderer(() => null)
  const canvas = createCanvas()
  const graph = createGraph()

  expect(renderSceneBacking(r, canvas, graph, 1)).toBe(false)
  expect(r.surface.makeSurface).toHaveBeenCalled()
  expect(canvas.drawImageRectOptions).not.toHaveBeenCalled()
  expect(r.sceneBacking).toBeNull()
})

test('retained scene backing bounds wide HiDPI allocations without depending on GPU limits', () => {
  const requests: ImageInfo[] = []
  const r = createRenderer((info) => {
    requests.push(info)
    return null
  })
  r.viewportWidth = 2998
  r.viewportHeight = 1490
  r.dpr = 2

  expect(renderSceneBacking(r, createCanvas(), createGraph(), 1)).toBe(false)
  expect(requests).toHaveLength(1)
  const request = requests[0]
  expect(request).toBeDefined()
  const viewportPixels = Math.ceil(r.viewportWidth * r.dpr) * Math.ceil(r.viewportHeight * r.dpr)
  expect((request?.width ?? 0) * (request?.height ?? 0)).toBeLessThanOrEqual(
    Math.max(16_010_000, viewportPixels)
  )
  expect(request?.width).toBe(Math.ceil(r.viewportWidth * r.dpr))
})

test('retained scene backing preserves the full margin when it fits the allocation budget', () => {
  const requests: ImageInfo[] = []
  const r = createRenderer((info) => {
    requests.push(info)
    return null
  })
  r.viewportWidth = 800
  r.viewportHeight = 600
  r.dpr = 1

  renderSceneBacking(r, createCanvas(), createGraph(), 1)

  expect(requests[0]).toMatchObject({ width: 2400, height: 1800 })
})

test('retained scene backing reports a throwing allocation and disables further attempts', () => {
  const error = new TypeError("Cannot set properties of null (setting 'be')")
  const r = createRenderer(() => {
    throw error
  })
  const canvas = createCanvas()
  const warn = spyOn(console, 'warn').mockImplementation(() => undefined)

  expect(() => renderSceneBacking(r, canvas, createGraph(), 1)).not.toThrow()
  expect(renderSceneBacking(r, canvas, createGraph(), 1)).toBe(false)

  expect(r.sceneBackingAllocationFailed).toBe(true)
  expect(r.surface.makeSurface).toHaveBeenCalledTimes(1)
  expect(warn).toHaveBeenCalledTimes(1)
  expect(warn).toHaveBeenCalledWith(
    'Disabling retained scene backing after CanvasKit failed to allocate 300×300',
    error
  )
  expect(r.sceneBacking).toBeNull()
  expect(canvas.drawImageRectOptions).not.toHaveBeenCalled()
  warn.mockRestore()
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
