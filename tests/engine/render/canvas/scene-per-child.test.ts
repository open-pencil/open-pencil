import { describe, expect, mock, test } from 'bun:test'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { render } from '#core/canvas/renderer/pipeline'
import { SceneGraph } from '#core/scene-graph'

type TestPicture = {
  delete: ReturnType<typeof mock>
}

function createPictureRecorder(recordedPictures: TestPicture[]) {
  return mock(function PictureRecorder() {
    const picture: TestPicture = {
      delete: mock()
    }
    recordedPictures.push(picture)

    return {
      beginRecording: mock(() => ({})),
      finishRecordingAsPicture: mock(() => picture),
      delete: mock()
    }
  })
}

function createGraphFixture() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const frameA = graph.createNode('FRAME', page.id, { width: 120, height: 120 })
  const leafA = graph.createNode('RECTANGLE', frameA.id, { width: 40, height: 40 })
  const frameB = graph.createNode('FRAME', page.id, { x: 200, width: 120, height: 120 })
  graph.createNode('RECTANGLE', frameB.id, { width: 40, height: 40 })
  return { frameA, frameB, graph, leafA, page }
}

function createRenderer(pageId: string) {
  const recordedPictures: TestPicture[] = []
  const canvas = {
    clear: mock(),
    drawPicture: mock(),
    restore: mock(),
    save: mock(),
    scale: mock(),
    translate: mock()
  }
  const profiler = {
    stats: {
      scenePictureMode: 'none' as 'hit' | 'record' | 'volatile' | 'none',
      scenePictureMissReason: '',
      scenePictureDrawTime: 0,
      scenePictureRecordTime: 0
    },
    beginFrame: mock(),
    endFrame: mock(),
    beginPhase: mock(),
    endPhase: mock(),
    setFlushTime: mock(),
    setNodeCounts: mock(),
    setScenePictureDrawTime: mock((ms: number) => {
      profiler.stats.scenePictureDrawTime = ms
    }),
    setScenePictureMode: mock((mode: 'hit' | 'record' | 'volatile' | 'none', reason = '') => {
      profiler.stats.scenePictureMode = mode
      profiler.stats.scenePictureMissReason = reason
    }),
    setScenePictureRecordTime: mock((ms: number) => {
      profiler.stats.scenePictureRecordTime = ms
    })
  }

  const renderer: Partial<SkiaRenderer> = {
    ck: {
      AlphaType: { Premul: 'Premul' },
      Color4f: mock((r: number, g: number, b: number, a: number) => [r, g, b, a]),
      ColorSpace: { SRGB: 'SRGB' },
      ColorType: { RGBA_8888: 'RGBA_8888' },
      LTRBRect: mock((left: number, top: number, right: number, bottom: number) => [
        left,
        top,
        right,
        bottom
      ]),
      PictureRecorder: createPictureRecorder(recordedPictures)
    } as SkiaRenderer['ck'],
    dpr: 1,
    labelCache: {
      update: mock()
    } as SkiaRenderer['labelCache'],
    pageColor: { r: 1, g: 1, b: 1, a: 1 },
    pageId,
    panX: 0,
    panY: 0,
    profiler: profiler as SkiaRenderer['profiler'],
    renderNode: mock(),
    sceneBacking: null,
    sceneBackingAverageRecordMs: 40,
    sceneBackingAverageViewportIntervalMs: 80,
    sceneBackingBuild: null,
    sceneBackingLastViewportEventAt: 0,
    sceneBackingNeedsCrispRender: false,
    sceneBackingPreviewUntil: 0,
    scenePicture: null,
    scenePicturePageId: null,
    scenePicturePositionPreviewVersion: -1,
    scenePictureVersion: -1,
    showRulers: false,
    subtreePictureCache: new Map(),
    subtreePictureCachePageId: null,
    subtreePictureCacheSceneVersion: -1,
    surface: {
      flush: mock(),
      getCanvas: mock(() => canvas),
      makeSurface: mock(() => null)
    } as SkiaRenderer['surface'],
    viewportHeight: 400,
    viewportWidth: 400,
    worldViewport: { x: 0, y: 0, w: 400, h: 400 },
    zoom: 1,
    _culledCount: 0,
    _nodeCount: 0,
    drawSectionTitles: mock(),
    drawComponentLabels: mock()
  }

  return {
    canvas,
    profiler,
    recordedPictures,
    renderer: renderer as SkiaRenderer
  }
}

function warmSceneCache(
  renderer: SkiaRenderer,
  graph: SceneGraph,
  sceneVersion: number
): number {
  render(renderer, graph, new Set(), {}, sceneVersion, 'scene')
  return renderer.subtreePictureCache.size
}

describe('render:scene per-child picture chain', () => {
  test('all child cache hits reuse cached pictures without recording', () => {
    const { graph, page } = createGraphFixture()
    const { canvas, profiler, recordedPictures, renderer } = createRenderer(page.id)

    expect(warmSceneCache(renderer, graph, 1)).toBe(2)
    recordedPictures.length = 0
    canvas.drawPicture.mockClear()

    render(renderer, graph, new Set(), {}, 1, 'scene')

    expect(recordedPictures).toHaveLength(0)
    expect(canvas.drawPicture).toHaveBeenCalledTimes(2)
    expect(profiler.stats.scenePictureMode).toBe('hit')
  })

  test('single subtreeVersion bump re-records only the changed page child', () => {
    const { graph, leafA, page } = createGraphFixture()
    const { canvas, profiler, recordedPictures, renderer } = createRenderer(page.id)

    expect(warmSceneCache(renderer, graph, 1)).toBe(2)
    recordedPictures.length = 0
    canvas.drawPicture.mockClear()

    graph.updateNode(leafA.id, { x: 40 })
    render(renderer, graph, new Set(), {}, 2, 'scene')

    expect(recordedPictures).toHaveLength(1)
    expect(canvas.drawPicture).toHaveBeenCalledTimes(2)
    expect(profiler.stats.scenePictureMode).toBe('record')
    expect(profiler.stats.scenePictureMissReason).toBe('scene-version')
  })

  test('sceneVersion-only bump keeps per-child cache hits alive', () => {
    const { graph, page } = createGraphFixture()
    const { canvas, profiler, recordedPictures, renderer } = createRenderer(page.id)

    expect(warmSceneCache(renderer, graph, 1)).toBe(2)
    recordedPictures.length = 0
    canvas.drawPicture.mockClear()

    render(renderer, graph, new Set(), {}, 2, 'scene')

    expect(recordedPictures).toHaveLength(0)
    expect(canvas.drawPicture).toHaveBeenCalledTimes(2)
    expect(profiler.stats.scenePictureMode).toBe('hit')
  })
})
