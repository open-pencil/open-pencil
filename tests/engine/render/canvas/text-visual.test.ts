import { describe, test, expect } from 'bun:test'

import { SceneGraph, SkiaRenderer as SkiaRendererClass } from '@open-pencil/core'

import { initCanvasKit } from '#cli/headless'
import { renderText } from '#core/canvas/scene'
import { fontManager } from '#core/text/fonts'

import { expectDefined } from '#tests/helpers/assert'
import { repoPath } from '#tests/helpers/paths'

describe('renderText headless visual', () => {
  test('renders CJK text via fallback font through paragraph shaper', async () => {
    const ck = await initCanvasKit()
    const fontProvider = ck.TypefaceFontProvider.Make()
    fontManager.attachProvider(ck, fontProvider)

    const interData = await Bun.file('public/Inter-Regular.ttf').arrayBuffer()
    fontProvider.registerFont(interData, 'Inter')
    fontManager.markLoaded('Inter', 'Regular', interData)

    const notoPath = repoPath('tests/fixtures/fonts/NotoSansSC-Regular.ttf')
    const notoData = await Bun.file(notoPath).arrayBuffer()
    fontProvider.registerFont(notoData, 'Noto Sans SC')
    fontManager.setCJKFallbackFamily('Noto Sans SC')

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('TEXT', page.id, {
      text: '你好世界',
      fontFamily: 'Inter',
      fontSize: 32,
      fontWeight: 400,
      width: 200,
      height: 50,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    const surface = expectDefined(ck.MakeSurface(200, 50), 'CanvasKit surface')
    const renderer = new SkiaRendererClass(ck, surface)
    renderer.viewportWidth = 200
    renderer.viewportHeight = 50
    renderer.dpr = 1
    renderer.fontsLoaded = true
    renderer.fontProvider = fontProvider

    const canvas = surface.getCanvas()
    canvas.clear(ck.WHITE)
    renderText(renderer, canvas, expectDefined(graph.getNode(node.id), 'text node'))
    surface.flush()

    const image = surface.makeImageSnapshot()
    const encoded = expectDefined(image.encodeToBytes(ck.ImageFormat.PNG, 100), 'encoded PNG')
    image.delete()
    surface.delete()

    expect(encoded.length).toBeGreaterThan(200)

    const decodedImage = expectDefined(ck.MakeImageFromEncoded(encoded), 'decoded PNG image')
    const pixels = decodedImage.readPixels(0, 0, {
      width: 200,
      height: 50,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    })
    decodedImage.delete()

    let darkPixels = 0
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] < 128 && pixels[i + 1] < 128 && pixels[i + 2] < 128) {
        darkPixels++
      }
    }
    // CJK characters are dense — should have many dark pixels if rendering correctly
    // Tofu boxes would have far fewer (just outlines)
    expect(darkPixels).toBeGreaterThan(500)
  })

  test('renders linear gradient text through the canvas scene fill path', async () => {
    const ck = await initCanvasKit()
    const fontProvider = ck.TypefaceFontProvider.Make()
    fontManager.attachProvider(ck, fontProvider)

    const interData = await Bun.file('public/Inter-Regular.ttf').arrayBuffer()
    fontProvider.registerFont(interData, 'Inter')
    fontManager.markLoaded('Inter', 'Regular', interData)

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('TEXT', page.id, {
      text: 'OPEN',
      fontFamily: 'Inter',
      fontSize: 64,
      fontWeight: 400,
      width: 220,
      height: 80,
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
        }
      ]
    })

    const surface = expectDefined(ck.MakeSurface(220, 80), 'CanvasKit surface')
    const renderer = new SkiaRendererClass(ck, surface)
    renderer.viewportWidth = 220
    renderer.viewportHeight = 80
    renderer.dpr = 1
    renderer.fontsLoaded = true
    renderer.fontProvider = fontProvider

    const canvas = surface.getCanvas()
    canvas.clear(ck.WHITE)
    renderer.renderShape(canvas, expectDefined(graph.getNode(node.id), 'text node'), graph)
    surface.flush()

    const image = surface.makeImageSnapshot()
    const pixels = image.readPixels(0, 0, {
      width: 220,
      height: 80,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    })
    image.delete()
    surface.delete()

    let redTextPixels = 0
    let blueTextPixels = 0
    for (let y = 0; y < 80; y++) {
      for (let x = 0; x < 220; x++) {
        const i = (y * 220 + x) * 4
        const r = pixels[i]
        const g = pixels[i + 1]
        const b = pixels[i + 2]
        if (g > 220) continue
        if (x < 110 && r > b + 40) redTextPixels++
        if (x >= 110 && b > r + 40) blueTextPixels++
      }
    }

    expect(redTextPixels).toBeGreaterThan(40)
    expect(blueTextPixels).toBeGreaterThan(40)
  })

  test('renders Arabic text via fallback font through paragraph shaper', async () => {
    const ck = await initCanvasKit()
    const fontProvider = ck.TypefaceFontProvider.Make()
    fontManager.attachProvider(ck, fontProvider)

    const interData = await Bun.file('public/Inter-Regular.ttf').arrayBuffer()
    fontProvider.registerFont(interData, 'Inter')
    fontManager.markLoaded('Inter', 'Regular', interData)

    const arabicPath = repoPath('tests/fixtures/fonts/NotoNaskhArabic-Regular.ttf')
    const arabicData = await Bun.file(arabicPath).arrayBuffer()
    fontProvider.registerFont(arabicData, 'Noto Naskh Arabic')
    fontManager.setArabicFallbackFamily('Noto Naskh Arabic')

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('TEXT', page.id, {
      text: 'مرحبا بالعالم',
      textDirection: 'AUTO',
      fontFamily: 'Inter',
      fontSize: 32,
      fontWeight: 400,
      width: 220,
      height: 60,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    const surface = expectDefined(ck.MakeSurface(220, 60), 'CanvasKit surface')
    const renderer = new SkiaRendererClass(ck, surface)
    renderer.viewportWidth = 220
    renderer.viewportHeight = 60
    renderer.dpr = 1
    renderer.fontsLoaded = true
    renderer.fontProvider = fontProvider

    const canvas = surface.getCanvas()
    canvas.clear(ck.WHITE)
    renderText(renderer, canvas, expectDefined(graph.getNode(node.id), 'text node'))
    surface.flush()

    const image = surface.makeImageSnapshot()
    const encoded = expectDefined(image.encodeToBytes(ck.ImageFormat.PNG, 100), 'encoded PNG')
    image.delete()
    surface.delete()

    expect(encoded.length).toBeGreaterThan(200)

    const decodedImage = expectDefined(ck.MakeImageFromEncoded(encoded), 'decoded PNG image')
    const pixels = decodedImage.readPixels(0, 0, {
      width: 220,
      height: 60,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    })
    decodedImage.delete()

    let darkPixels = 0
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] < 128 && pixels[i + 1] < 128 && pixels[i + 2] < 128) {
        darkPixels++
      }
    }
    expect(darkPixels).toBeGreaterThan(450)
  })
})
