import { expect, mock, test } from 'bun:test'

import type { Font, Paint, Surface } from 'canvaskit-wasm'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { destroyRenderer } from '#core/canvas/renderer/lifecycle'

function deletable<T>() {
  return { delete: mock() } as T & { delete: ReturnType<typeof mock> }
}

function createRenderer() {
  const renderer: Partial<SkiaRenderer> = {
    destroyed: false,
    imageCache: new Map(),
    vectorPathCache: new Map(),
    vectorStrokePathCache: new Map(),
    vectorStrokeOutlineCache: new Map(),
    fillGeometryCache: new Map(),
    strokeGeometryCache: new Map(),
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
    paragraphFontMgrCache: new Map([['font-mgr', deletable()]]),
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
    subtreePictureCache: new Map(),
    scenePicture: null,
    sceneBacking: null,
    sceneBackingBuild: null,
    _flashPaint: null,
    profiler: { destroy: mock() } as Partial<SkiaRenderer['profiler']> as SkiaRenderer['profiler'],
    surface: deletable<Surface>()
  }
  return renderer as SkiaRenderer
}

test('destroyRenderer deletes all renderer-owned paints and label fonts', () => {
  const renderer = createRenderer()
  const parentOutlinePaint = renderer.parentOutlinePaint
  const sectionTitleFont = renderer.sectionTitleFont
  const componentLabelFont = renderer.componentLabelFont
  const paragraphFontMgr = renderer.paragraphFontMgrCache.get('font-mgr')

  destroyRenderer(renderer)

  expect(parentOutlinePaint.delete).toHaveBeenCalled()
  expect(sectionTitleFont?.delete).toHaveBeenCalled()
  expect(componentLabelFont?.delete).toHaveBeenCalled()
  expect(paragraphFontMgr?.delete).toHaveBeenCalled()
  expect(renderer.paragraphFontMgrCache.size).toBe(0)
})
