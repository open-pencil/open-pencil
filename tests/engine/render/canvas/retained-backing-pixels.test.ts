import { beforeAll, expect, spyOn, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { initCanvasKit } from '#cli/headless'
import { SkiaRenderer } from '#core/canvas'
import { render } from '#core/canvas/renderer/pipeline'
import { renderSceneBacking } from '#core/canvas/renderer/retained-backing'

import { expectDefined } from '#tests/helpers/assert'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
})

function createFixture() {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  for (const x of [20, 40.25, 60.5, 80.75]) {
    graph.createNode('RECTANGLE', page.id, {
      x,
      y: 20,
      width: 1,
      height: 80,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
  }
  return { graph, pageId: page.id }
}

function createRenderer(pageId: string) {
  const surface = expectDefined(ck.MakeSurface(2176, 2128), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  renderer.viewportWidth = 1088
  renderer.viewportHeight = 1064
  renderer.dpr = 2
  renderer.pageId = pageId
  renderer.pageColor = { r: 1, g: 1, b: 1, a: 1 }
  renderer.panX = 0.125
  renderer.panY = 0.375
  return renderer
}

for (const scope of ['matching', 'scene', 'preview', 'page', 'font'] as const) {
  test(`backing installation preserves only a matching whole-scene picture: ${scope}`, () => {
    const { graph, pageId } = createFixture()
    const renderer = createRenderer(pageId)
    try {
      render(renderer, graph, new Set(), {}, 1, 'full')
      const picture = expectDefined(renderer.scenePicture, 'whole-scene picture')
      const deletion = spyOn(picture, 'delete')
      try {
        if (scope === 'scene') renderer.scenePictureVersion--
        if (scope === 'preview') renderer.scenePicturePositionPreviewVersion--
        if (scope === 'page') renderer.scenePicturePageId = null
        if (scope === 'font') renderer.scenePictureFontGeneration--
        expect(renderSceneBacking(renderer, renderer.surface.getCanvas(), graph, 1)).not.toBe(false)
        expect(renderer.scenePicture).toBe(scope === 'matching' ? picture : null)
        expect(deletion).toHaveBeenCalledTimes(scope === 'matching' ? 0 : 1)
        expect(renderer.scenePictureVersion).toBe(1)
        expect(renderer.scenePicturePositionPreviewVersion).toBe(graph.positionPreviewVersion)
      } finally {
        deletion.mockRestore()
      }
    } finally {
      renderer.destroy()
    }
  })
}

function pixels(renderer: SkiaRenderer) {
  renderer.surface.flush()
  const image = renderer.surface.makeImageSnapshot()
  try {
    return expectDefined(
      image.readPixels(0, 0, {
        width: 200,
        height: 220,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'scene pixels'
    )
  } finally {
    image.delete()
  }
}

function directPixels(renderer: SkiaRenderer, graph: SceneGraph, pageId: string) {
  const canvas = renderer.surface.getCanvas()
  canvas.clear(ck.WHITE)
  canvas.save()
  try {
    canvas.scale(renderer.dpr, renderer.dpr)
    canvas.translate(renderer.panX, renderer.panY)
    canvas.scale(renderer.zoom, renderer.zoom)
    renderer.renderSceneToCanvas(canvas, graph, pageId)
  } finally {
    canvas.restore()
  }
  return pixels(renderer)
}

test('capped backing preserves the pixel grid after fractional pan and pixel-density changes', () => {
  const { graph, pageId } = createFixture()
  const direct = createRenderer(pageId)
  const retained = createRenderer(pageId)
  try {
    for (const { pan, dpr, zoom } of [
      { pan: 0.125, dpr: 2, zoom: 1 },
      { pan: 0.25, dpr: 2, zoom: 1 },
      { pan: 0.25, dpr: 1, zoom: 1 },
      { pan: 0.25, dpr: 2, zoom: 1 },
      { pan: 0.1, dpr: 1.25, zoom: 1 },
      { pan: 0.3, dpr: 1.5, zoom: 1 },
      { pan: 0.3, dpr: 1.5, zoom: 1.00001 }
    ]) {
      direct.zoom = zoom
      retained.zoom = zoom
      direct.panX = pan
      retained.panX = pan
      direct.dpr = dpr
      retained.dpr = dpr
      retained.sceneBackingPreviewUntil = 0
      retained.render(graph, new Set(), {}, 1, 'scene')
      for (let frame = 0; frame < 20 && retained.sceneBackingNeedsCrispRender; frame++) {
        retained.sceneBackingPreviewUntil = 0
        retained.render(graph, new Set(), {}, 1, 'scene')
      }
      expect(retained.sceneBackingNeedsCrispRender).toBe(false)
      const backing = expectDefined(retained.sceneBacking, 'settled backing')
      expect(backing.zoom).toBe(zoom)
      expect(backing.anchorPanX).toBe(pan)
      // Matching an unchanged viewport must not repeatedly rebuild due to
      // floating-point subtraction of the overscan margin.
      retained.render(graph, new Set(), {}, 1, 'scene')
      expect(retained.sceneBacking).toBe(backing)
      const expected = directPixels(direct, graph, pageId)
      const actual = pixels(retained)
      const differingChannels = actual.reduce(
        (count, value, index) => count + Number(value !== expected[index]),
        0
      )
      expect(differingChannels).toBe(0)
    }
  } finally {
    direct.destroy()
    retained.destroy()
  }
})

test('settlement reuses pictures and the navigation image without another cache', () => {
  const { graph, pageId } = createFixture()
  const renderer = createRenderer(pageId)
  try {
    renderer.render(graph, new Set(), {}, 1, 'scene')
    const backing = expectDefined(renderer.sceneBacking, 'backing')
    const pictures = new Map(
      [...renderer.subtreePictureCache].map(([id, entry]) => [id, entry.picture])
    )
    expect(pictures.size).toBeGreaterThan(0)
    const nodeDraws = spyOn(renderer, 'renderNode')
    const allocations = spyOn(renderer.surface, 'makeSurface')
    try {
      renderer.sceneBackingPreviewUntil = 0
      renderer.render(graph, new Set(), {}, 1, 'scene')
      expect(renderer.profiler.stats.scenePictureMissReason).toBe('retained-pictures')
      expect(renderer.sceneBacking).toBe(backing)
      expect(renderer.scenePicture).toBeNull()
      expect(renderer.subtreePictureCache.size).toBe(pictures.size)
      for (const [id, picture] of pictures)
        expect(renderer.subtreePictureCache.get(id)?.picture).toBe(picture)
      expect(nodeDraws).not.toHaveBeenCalled()
      expect(allocations).not.toHaveBeenCalled()
      renderer.navigationPhase = 'pan'
      renderer.render(graph, new Set(), {}, 1, 'scene')
      expect(renderer.profiler.stats.scenePictureMissReason).toBe('backing')
      expect(renderer.sceneBacking).toBe(backing)
      expect(nodeDraws).not.toHaveBeenCalled()
      expect(allocations).not.toHaveBeenCalled()
    } finally {
      nodeDraws.mockRestore()
      allocations.mockRestore()
    }
  } finally {
    renderer.destroy()
  }
})

test('active edits draw directly without replacing the overscan backing', () => {
  const { graph, pageId } = createFixture()
  const renderer = createRenderer(pageId)
  try {
    renderer.render(graph, new Set(), {}, 1, 'scene')
    const backing = expectDefined(renderer.sceneBacking, 'initial backing')
    renderer.sceneBackingNeedsCrispRender = true
    renderer.tiledScenePending = true
    for (const sceneVersion of [2, 3, 4]) {
      render(renderer, graph, new Set(), {}, sceneVersion, 'scene', true)
      expect(renderer.sceneBacking).toBe(backing)
      expect(renderer.sceneBackingBuild).toBeNull()
      expect(renderer.sceneBackingNeedsCrispRender).toBe(false)
      expect(renderer.tiledScenePending).toBe(false)
      expect(renderer.profiler.stats.scenePictureMode).toBe('volatile')
      expect(renderer.profiler.stats.scenePictureMissReason).toBe('active-edit')
    }
    renderer.render(graph, new Set(), {}, 4, 'scene')
    expect(renderer.sceneBacking?.sceneVersion).toBe(4)
    expect(renderer.sceneBacking).not.toBe(backing)
  } finally {
    renderer.destroy()
  }
})
