import { expect, test, mock } from 'bun:test'

import type { Font, Paint, Surface } from '@open-pencil/canvaskit'
import { expectDefined } from '@open-pencil/test-support/assert'

import { SkiaRenderer } from '#core/canvas'
import { createImageFilterCache, createMaskFilterCache } from '#core/canvas/effects'
import { createGlassMapCache } from '#core/canvas/glass/map'
import { createRendererImages } from '#core/canvas/images/state'
import { IssueMarkerStage } from '#core/canvas/issues/stage'
import type { NodeEditPaints } from '#core/canvas/node-edit-overlay'
import { createDashEffectCache } from '#core/canvas/overlays/outline'
import { NodePathCaches } from '#core/canvas/paths/cache'
import { destroyRenderer } from '#core/canvas/renderer/lifecycle'
import { createCompiledShaders } from '#core/canvas/renderer/shaders'
import { createWholeScenePicture } from '#core/canvas/renderer/state'
import { createTextCaches } from '#core/canvas/text/caches'
import { TextPreparationCache } from '#core/canvas/text/preparation/cache'
import { getCanvasKit } from '#core/canvaskit'
import { fontManager } from '#core/text/font/manager'

import { asDouble, asRenderer } from '../helpers'

const ck = await getCanvasKit()

const renderer = () => new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1), 'surface'))

test('destroying a renderer that never loaded fonts leaves the others their fonts', async () => {
  const drawing = renderer()
  await drawing.loadFonts()
  const provider = expectDefined(drawing.getFontProvider(), 'font provider')
  try {
    renderer().destroy()
    expect(fontManager.providerFor(ck)).toBe(provider)
  } finally {
    drawing.destroy()
  }
})

function deletable<T>() {
  return { delete: mock() } as T & { delete: ReturnType<typeof mock> }
}

function createRenderer() {
  const renderer: Partial<SkiaRenderer> = {
    destroyed: false,
    textPreparationCache: new TextPreparationCache(),
    transientPreviews: new Map(),
    images: createRendererImages(),
    nodePaths: new NodePathCaches(),
    textCaches: createTextCaches(),
    fillPaint: deletable<Paint>(),
    strokePaint: deletable<Paint>(),
    selectionPaint: deletable<Paint>(),
    snapPaint: deletable<Paint>(),
    auxFill: deletable<Paint>(),
    auxStroke: deletable<Paint>(),
    opacityPaint: deletable<Paint>(),
    effectLayerPaint: deletable<Paint>(),
    chromeFonts: {
      text: deletable<Font>(),
      label: deletable<Font>(),
      size: deletable<Font>(),
      value: null,
      sectionTitle: deletable<Font>(),
      componentLabel: deletable<Font>()
    },
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
    glassMaps: createGlassMapCache(),
    dashEffects: createDashEffectCache(),
    shaders: createCompiledShaders(),
    maskFilterCache: createMaskFilterCache(),
    nodeEditPaints: {
      techStrokePaint: deletable<Paint>()
    } as Partial<NodeEditPaints> as NodeEditPaints,
    nodePictures: new Map(),
    issueMarkerStage: new IssueMarkerStage(),
    wholeScene: createWholeScenePicture(),
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
  const { sectionTitle, componentLabel } = renderer.chromeFonts
  const pencilStrokePaint = renderer.pencilStrokePaint

  destroyRenderer(renderer)

  expect(pencilStrokePaint.delete).toHaveBeenCalled()
  expect(sectionTitle?.delete).toHaveBeenCalled()
  expect(componentLabel?.delete).toHaveBeenCalled()
})
