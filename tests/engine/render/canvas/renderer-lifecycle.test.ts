import { expect, mock, test } from 'bun:test'

import type { Font, Paint, Surface } from 'canvaskit-wasm'

import { createImageFilterCache, createMaskFilterCache } from '#core/canvas/effects'
import { createImageCache } from '#core/canvas/images/cache'
import { ImagePreviewCache } from '#core/canvas/images/previews'
import type { NodeEditPaints } from '#core/canvas/node-edit-overlay'
import { createDashEffectCache } from '#core/canvas/overlays/outline'
import { NodePathCaches } from '#core/canvas/paths/cache'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { EffectRasterCache } from '#core/canvas/renderer/effect-raster-cache'
import { destroyRenderer } from '#core/canvas/renderer/lifecycle'
import { createDerivedGlyphPathCache, createGlyphSilhouetteCache } from '#core/canvas/text/derived'
import { createEmojiImageCache } from '#core/canvas/text/emoji'
import { TextPreparationCache } from '#core/canvas/text/preparation/cache'

import { asDouble, asRenderer } from './helpers'

function deletable<T>() {
  return { delete: mock() } as T & { delete: ReturnType<typeof mock> }
}

function createRenderer() {
  const renderer: Partial<SkiaRenderer> = {
    destroyed: false,
    textPreparationCache: new TextPreparationCache(),
    transientPreviews: new Map(),
    imageCache: createImageCache(),
    liveImages: new Map(),
    imagePreviews: new ImagePreviewCache(() => undefined),
    onImagePreviewReady: null,
    nodePaths: new NodePathCaches(),
    glyphSilhouetteCache: createGlyphSilhouetteCache(),
    derivedGlyphPathCache: createDerivedGlyphPathCache(),
    emojiImageCache: createEmojiImageCache(),
    fillPaint: deletable<Paint>(),
    strokePaint: deletable<Paint>(),
    selectionPaint: deletable<Paint>(),
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
    pencilStrokePaint: deletable<Paint>(),
    penHandlePaint: deletable<Paint>(),
    penVertexFill: deletable<Paint>(),
    penVertexStroke: deletable<Paint>(),
    imageFilterCache: createImageFilterCache(),
    dashEffects: createDashEffectCache(),
    pixelGridShader: null,
    maskFilterCache: createMaskFilterCache(),
    nodeEditPaints: {
      techStrokePaint: deletable<Paint>()
    } as Partial<NodeEditPaints> as NodeEditPaints,
    nodePictureCache: new Map(),
    effectRasterCache: new EffectRasterCache(),
    subtreePictureCache: new Map(),
    scenePicture: null,
    sceneBacking: null,
    sceneBackingBuild: null,
    tiledScene: asDouble<SkiaRenderer['tiledScene']>({ destroy: mock() }),
    labelParagraphCache: asDouble<SkiaRenderer['labelParagraphCache']>({ clear: mock() }),
    profiler: { destroy: mock() } as Partial<SkiaRenderer['profiler']> as SkiaRenderer['profiler'],
    surface: deletable<Surface>()
  }
  return asRenderer(renderer)
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
  const sectionTitleFont = renderer.sectionTitleFont
  const componentLabelFont = renderer.componentLabelFont
  const pencilStrokePaint = renderer.pencilStrokePaint

  destroyRenderer(renderer)

  expect(pencilStrokePaint.delete).toHaveBeenCalled()
  expect(sectionTitleFont?.delete).toHaveBeenCalled()
  expect(componentLabelFont?.delete).toHaveBeenCalled()
})
