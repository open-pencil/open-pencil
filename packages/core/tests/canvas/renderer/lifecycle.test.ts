import { expect, test, mock, spyOn } from 'bun:test'

import type { Font, Paint, Surface } from '@open-pencil/canvaskit'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { SkiaRenderer } from '#core/canvas'
import { createImageFilterCache, createMaskFilterCache } from '#core/canvas/effects'
import { createGlassMapCache } from '#core/canvas/glass/map'
import { createRendererImages } from '#core/canvas/images/state'
import { IssueMarkerStage } from '#core/canvas/issues/stage'
import type { NodeEditPaints } from '#core/canvas/overlays/node-edit'
import { createDashEffectCache } from '#core/canvas/overlays/outline'
import { NodePathCaches } from '#core/canvas/paths/cache'
import { destroyRenderer } from '#core/canvas/renderer/lifecycle'
import { createCompiledShaders } from '#core/canvas/renderer/shaders'
import { createWholeScenePicture } from '#core/canvas/renderer/state'
import { RenderedBoundsCache } from '#core/canvas/renderer/visual-bounds'
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

test('font reload and renderer teardown release the typefaces loaded for the chrome', async () => {
  const made = spyOn(ck.Typeface, 'MakeFreeTypeFaceFromData')
  const faces = () =>
    made.mock.results.flatMap((result) =>
      result.type === 'return' && result.value ? [result.value] : []
    )
  const drawing = renderer()
  try {
    await drawing.loadFonts()
    const first = faces()
    expect(first.length).toBeGreaterThan(0)
    await drawing.loadFonts()
    expect(first.every((face) => face.isDeleted())).toBe(true)
    drawing.profiler.setVisible(true)
    drawing.profiler.drawHUD(drawing.surface.getCanvas(), false)
    drawing.destroy()
    expect(faces().every((face) => face.isDeleted())).toBe(true)
  } finally {
    drawing.destroy()
    made.mockRestore()
  }
})

test('replacing and destroying software surfaces releases their WASM pixel buffers', () => {
  const heap = ck as typeof ck & {
    _malloc: (bytes: number) => number
    _free: (ptr: number) => void
  }
  const allocated = spyOn(heap, '_malloc')
  const freed = spyOn(heap, '_free')
  try {
    const width = 48
    const height = 32
    const first = expectDefined(ck.MakeSurface(width, height))
    const next = expectDefined(ck.MakeSurface(width, height))
    const buffers = allocated.mock.calls.flatMap(([bytes], i) =>
      bytes === width * height * 4 ? [allocated.mock.results[i].value] : []
    )
    const drawing = new SkiaRenderer(ck, first)
    try {
      drawing.replaceSurface(next)
      expect(buffers).toHaveLength(2)
      expect(freed).toHaveBeenCalledWith(buffers[0])
      expect(freed).not.toHaveBeenCalledWith(buffers[1])
    } finally {
      drawing.destroy()
    }
    expect(freed).toHaveBeenCalledWith(buffers[1])
  } finally {
    allocated.mockRestore()
    freed.mockRestore()
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
    renderedBounds: new RenderedBoundsCache(),
    issueMarkerStage: new IssueMarkerStage(),
    wholeScene: createWholeScenePicture(),
    tiledScene: asDouble<SkiaRenderer['tiledScene']>({ destroy: mock() }),
    labelParagraphCache: asDouble<SkiaRenderer['labelParagraphCache']>({ clear: mock() }),
    profiler: { destroy: mock() } as Partial<SkiaRenderer['profiler']> as SkiaRenderer['profiler'],
    surface: asDouble<Surface>({ dispose: mock() })
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
  renderer.surface.dispose = mock(() => teardown.push('surface'))

  destroyRenderer(renderer)

  expect(renderer.tiledScene.destroy).toHaveBeenCalledTimes(1)
  expect(renderer.surface.dispose).toHaveBeenCalledTimes(1)
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

test('destroyRenderer stops the bounds cache watching the graphs it measured', () => {
  const renderer = createRenderer()
  const graph = new SceneGraph()
  const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, { width: 10, height: 10 })
  const unobserve = mock()
  graph.observeNodeChanges = mock(() => unobserve)

  renderer.renderedBounds.ownAxes(graph, node)
  destroyRenderer(renderer)

  expect(graph.observeNodeChanges).toHaveBeenCalledTimes(1)
  expect(unobserve).toHaveBeenCalledTimes(1)
})
