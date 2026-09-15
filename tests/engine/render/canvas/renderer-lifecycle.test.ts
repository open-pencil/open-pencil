import { expect, mock, test } from 'bun:test'

import type { Font, Paint, Surface } from 'canvaskit-wasm'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { EffectRasterCache } from '#core/canvas/renderer/effect-raster-cache'
import { destroyRenderer } from '#core/canvas/renderer/lifecycle'
import { createGlyphSilhouetteCache } from '#core/canvas/text/derived'
import { TextPreparationCache } from '#core/canvas/text/preparation-cache'

function deletable<T>() {
  return { delete: mock() } as T & { delete: ReturnType<typeof mock> }
}

function createRenderer() {
  const renderer: Partial<SkiaRenderer> = {
    destroyed: false,
    textPreparationCache: new TextPreparationCache(),
    imageCache: new Map(),
    vectorPathCache: new Map(),
    vectorStrokePathCache: new Map(),
    vectorStrokeOutlineCache: new Map(),
    fillGeometryCache: new Map(),
    strokeGeometryCache: new Map(),
    glyphSilhouetteCache: createGlyphSilhouetteCache(),
    fillPaint: deletable<Paint>(),
    strokePaint: deletable<Paint>(),
    selectionPaint: deletable<Paint>(),
    parentOutlinePaint: deletable<Paint>(),
    snapPaint: deletable<Paint>(),
    auxFill: deletable<Paint>(),
    auxStroke: deletable<Paint>(),
    opacityPaint: deletable<Paint>(),
    effectLayerPaint: deletable<Paint>(),
    textFont: deletable<Font>(),
    labelFont: deletable<Font>(),
    sizeFont: deletable<Font>(),
    sectionTitleFont: deletable<Font>(),
    componentLabelFont: deletable<Font>(),
    fontMgr: null,
    fontProvider: null,
    fontsLoaded: true,
    rulerBgPaint: deletable<Paint>(),
    rulerTickPaint: deletable<Paint>(),
    rulerTextPaint: deletable<Paint>(),
    rulerHlPaint: deletable<Paint>(),
    rulerBadgePaint: deletable<Paint>(),
    rulerLabelPaint: deletable<Paint>(),
    penPathPaint: deletable<Paint>(),
    penLiveStrokePaint: deletable<Paint>(),
    penHandlePaint: deletable<Paint>(),
    penVertexFill: deletable<Paint>(),
    penVertexStroke: deletable<Paint>(),
    imageFilterCache: new Map(),
    maskFilterCache: new Map(),
    nodePictureCache: new Map(),
    effectRasterCache: new EffectRasterCache(),
    subtreePictureCache: new Map(),
    scenePicture: null,
    sceneBacking: null,
    sceneBackingBuild: null,
    tiledScene: { destroy: mock() } as SkiaRenderer['tiledScene'],
    labelParagraphCache: { clear: mock() } as SkiaRenderer['labelParagraphCache'],
    _flashPaint: null,
    profiler: { destroy: mock() } as Partial<SkiaRenderer['profiler']> as SkiaRenderer['profiler'],
    surface: deletable<Surface>()
  }
  return renderer as SkiaRenderer
}

test('destroyRenderer releases tiled resources before deleting the main surface', () => {
  const renderer = createRenderer()
  const teardown: string[] = []
  renderer.textPreparationCache.clear = mock(() => {
    teardown.push('text')
  })
  renderer.tiledScene.destroy = mock(() => teardown.push('tiled'))
  renderer.surface.delete = mock(() => teardown.push('surface')) as typeof renderer.surface.delete

  destroyRenderer(renderer)

  expect(renderer.tiledScene.destroy).toHaveBeenCalledTimes(1)
  expect(renderer.surface.delete).toHaveBeenCalledTimes(1)
  expect(teardown).toEqual(['text', 'tiled', 'surface'])
})

test('destroyRenderer deletes all renderer-owned paints and label fonts', () => {
  const renderer = createRenderer()
  const parentOutlinePaint = renderer.parentOutlinePaint
  const sectionTitleFont = renderer.sectionTitleFont
  const componentLabelFont = renderer.componentLabelFont

  destroyRenderer(renderer)

  expect(parentOutlinePaint.delete).toHaveBeenCalled()
  expect(sectionTitleFont?.delete).toHaveBeenCalled()
  expect(componentLabelFont?.delete).toHaveBeenCalled()
})
