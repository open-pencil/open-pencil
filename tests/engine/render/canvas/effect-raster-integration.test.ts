import { beforeAll, describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { initCanvasKit } from '#cli/headless'
import { SkiaRenderer } from '#core/canvas'

import { expectDefined } from '#tests/helpers/assert'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
})

function createEffectGraph(effectType: 'DROP_SHADOW' | 'BACKGROUND_BLUR') {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  if (!page) throw new Error('Expected default page')
  const effect =
    effectType === 'DROP_SHADOW'
      ? {
          type: 'DROP_SHADOW' as const,
          color: { r: 0.05, g: 0.1, b: 0.2, a: 0.7 },
          offset: { x: 8, y: 10 },
          radius: 12,
          spread: 2,
          visible: true
        }
      : {
          type: 'BACKGROUND_BLUR' as const,
          color: { r: 0, g: 0, b: 0, a: 0 },
          offset: { x: 0, y: 0 },
          radius: 12,
          spread: 0,
          visible: true
        }
  graph.createNode('RECTANGLE', page.id, {
    x: 50,
    y: 50,
    width: 100,
    height: 80,
    fills: [
      {
        type: 'SOLID',
        color: { r: 0.3, g: 0.6, b: 0.9, a: 1 },
        opacity: 1,
        visible: true
      }
    ],
    effects: [effect]
  })
  return { graph, pageId: page.id }
}

function renderPixels(renderer: SkiaRenderer, graph: SceneGraph): Uint8Array {
  renderer.render(graph, new Set(), {}, 1, 'scene')
  const image = renderer.surface.makeImageSnapshot()
  const pixels = image.readPixels(0, 0, {
    width: 256,
    height: 192,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB
  })
  image.delete()
  return expectDefined(pixels, 'retained backing pixels')
}

function differingChannels(a: Uint8Array, b: Uint8Array, tolerance: number): number {
  let different = 0
  for (let index = 0; index < a.length; index++) {
    if (Math.abs(a[index] - b[index]) > tolerance) different++
  }
  return different
}

describe('retained effect raster integration', () => {
  test('settled drop-shadow backing closely matches direct rendering', () => {
    const { graph, pageId } = createEffectGraph('DROP_SHADOW')
    const directSurface = expectDefined(ck.MakeSurface(256, 192), 'direct surface')
    const backingSurface = expectDefined(ck.MakeSurface(256, 192), 'backing surface')
    const direct = new SkiaRenderer(ck, directSurface)
    const retained = new SkiaRenderer(ck, backingSurface)
    for (const renderer of [direct, retained]) {
      renderer.viewportWidth = 256
      renderer.viewportHeight = 192
      renderer.pageId = pageId
      renderer.pageColor = { r: 1, g: 1, b: 1, a: 1 }
      renderer.dpr = 1
      renderer.zoom = 1
    }

    try {
      direct.renderingSceneBacking = false
      direct.surface.getCanvas().clear(ck.WHITE)
      direct.renderSceneToCanvas(direct.surface.getCanvas(), graph, pageId)
      direct.surface.flush()
      const directImage = direct.surface.makeImageSnapshot()
      const directPixels = expectDefined(
        directImage.readPixels(0, 0, {
          width: 256,
          height: 192,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Unpremul,
          colorSpace: ck.ColorSpace.SRGB
        }),
        'direct pixels'
      )
      directImage.delete()

      const retainedPixels = renderPixels(retained, graph)
      expect(retained.effectRasterCache.size).toBe(1)
      expect(differingChannels(directPixels, retainedPixels, 12)).toBeLessThan(
        directPixels.length * 0.02
      )
    } finally {
      direct.destroy()
      retained.destroy()
    }
  })

  test('nested shadow subtrees retain the single-picture backing path', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    if (!page) throw new Error('Expected default page')
    const frame = graph.createNode('FRAME', page.id, { width: 200, height: 160 })
    graph.createNode('RECTANGLE', frame.id, {
      x: 20,
      y: 20,
      width: 100,
      height: 80,
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 4, y: 6 },
          radius: 8,
          spread: 0,
          visible: true
        }
      ]
    })
    const surface = expectDefined(ck.MakeSurface(256, 192), 'nested shadow surface')
    const renderer = new SkiaRenderer(ck, surface)
    renderer.viewportWidth = 256
    renderer.viewportHeight = 192
    renderer.pageId = page.id
    try {
      renderPixels(renderer, graph)
      expect(renderer.effectRasterCache.size).toBe(0)
      expect(renderer.subtreePictureCache.has(frame.id)).toBe(true)
    } finally {
      renderer.destroy()
    }
  })

  test('backdrop-dependent blur remains on the picture fallback', () => {
    const { graph, pageId } = createEffectGraph('BACKGROUND_BLUR')
    const surface = expectDefined(ck.MakeSurface(256, 192), 'blur surface')
    const renderer = new SkiaRenderer(ck, surface)
    renderer.viewportWidth = 256
    renderer.viewportHeight = 192
    renderer.pageId = pageId
    try {
      renderPixels(renderer, graph)
      expect(renderer.effectRasterCache.size).toBe(0)
    } finally {
      renderer.destroy()
    }
  })
})
