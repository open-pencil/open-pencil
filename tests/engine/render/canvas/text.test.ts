import { describe, test, expect, mock } from 'bun:test'

import { initCanvasKit } from '#cli/headless'
import { renderText } from '#core/canvas/scene'
import { fontManager } from '#core/text/fonts'
import { repoPath } from '#tests/helpers/paths'

import { SceneGraph, SkiaRenderer as SkiaRendererClass } from '@open-pencil/core'
import { detectTextDirection, resolveTextDirection } from '@open-pencil/core'

import type { SkiaRenderer } from '#core/canvas/renderer'
import type { SceneNode } from '#core/scene-graph'

function createMockCanvas() {
  return {
    drawParagraph: mock(() => {}),
    drawPicture: mock(() => {}),
    drawText: mock(() => {}),
    drawRect: mock(() => {}),
    save: mock(() => {}),
    saveLayer: mock(() => {}),
    restore: mock(() => {}),
    clipRect: mock(() => {})
  }
}

function createMockParagraph() {
  return { delete: mock(() => {}) }
}

function createMockPicture() {
  return { delete: mock(() => {}) }
}

function createMockRenderer(overrides: Partial<Record<string, unknown>> = {}) {
  const paragraph = createMockParagraph()
  return {
    fontsLoaded: true,
    fontProvider: {},
    textFont: {},
    fillPaint: { getColor: () => new Float32Array([0, 0, 0, 1]) },
    effectLayerPaint: {
      setBlendMode: mock(() => {}),
      setColorFilter: mock(() => {}),
      setImageFilter: mock(() => {})
    },
    ck: {
      MakePicture: mock(() => createMockPicture()),
      LTRBRect: mock((...args: number[]) => args),
      Color4f: mock((...args: number[]) => new Float32Array(args)),
      BlendMode: { SrcOver: 0, SrcIn: 1 },
      ClipOp: { Intersect: 0 }
    },
    DEFAULT_FONT_SIZE: 14,
    isNodeFontLoaded: mock(() => true),
    buildParagraph: mock(() => paragraph),
    _paragraph: paragraph,
    ...overrides
  } as SkiaRenderer & { _paragraph: ReturnType<typeof createMockParagraph> }
}

function textNode(overrides: Partial<SceneNode> = {}): SceneNode {
  return {
    text: 'Hello 你好',
    fontSize: 16,
    fontFamily: 'Arial',
    ...overrides
  } as SceneNode
}

describe('renderText', () => {
  test('uses buildParagraph when fonts are loaded and node font is available', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()

    renderText(r, canvas as never, textNode())

    expect(r.buildParagraph).toHaveBeenCalledTimes(1)
    expect(canvas.drawParagraph).toHaveBeenCalledTimes(1)
    expect(canvas.drawText).not.toHaveBeenCalled()
    expect(r._paragraph.delete).toHaveBeenCalledTimes(1)
  })

  test('uses paragraph even when node font is NOT available (fallback to default)', () => {
    const r = createMockRenderer({ isNodeFontLoaded: mock(() => false) })
    const canvas = createMockCanvas()

    renderText(r, canvas as never, textNode())

    expect(r.buildParagraph).toHaveBeenCalledTimes(1)
    expect(canvas.drawParagraph).toHaveBeenCalledTimes(1)
    expect(canvas.drawText).not.toHaveBeenCalled()
  })

  test('renders gradient text through a paragraph mask', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()

    renderText(r, canvas as never, textNode(), {
      type: 'GRADIENT_LINEAR',
      visible: true,
      opacity: 1,
      gradientStops: [],
      gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    })

    expect(r.buildParagraph).toHaveBeenCalledTimes(1)
    expect(canvas.saveLayer).toHaveBeenCalledTimes(2)
    expect(canvas.drawParagraph).toHaveBeenCalledTimes(1)
    expect(canvas.drawRect).toHaveBeenCalledTimes(1)
    expect(r.effectLayerPaint.setBlendMode).toHaveBeenCalledWith(r.ck.BlendMode.SrcIn)
    expect(r._paragraph.delete).toHaveBeenCalledTimes(1)
  })

  test('prefers textPicture over paragraph', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node = textNode({ textPicture: new Uint8Array([1, 2, 3]) })

    renderText(r, canvas as never, node)

    expect(canvas.drawPicture).toHaveBeenCalledTimes(1)
    expect(r.buildParagraph).not.toHaveBeenCalled()
  })

  test('falls back to drawText only when fonts are NOT loaded', () => {
    const r = createMockRenderer({ fontsLoaded: false, fontProvider: null })
    const canvas = createMockCanvas()

    renderText(r, canvas as never, textNode())

    expect(canvas.drawText).toHaveBeenCalledTimes(1)
    expect(r.buildParagraph).not.toHaveBeenCalled()
  })

  test('does nothing for empty text', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()

    renderText(r, canvas as never, textNode({ text: '' }))

    expect(r.buildParagraph).not.toHaveBeenCalled()
    expect(canvas.drawText).not.toHaveBeenCalled()
    expect(canvas.drawPicture).not.toHaveBeenCalled()
  })
})

describe('renderText headless visual', () => {
  test('detects base direction for Arabic and mixed text', () => {
    expect(detectTextDirection('مرحبا')).toBe('RTL')
    expect(resolveTextDirection('AUTO', 'مرحبا world')).toBe('RTL')
    expect(resolveTextDirection('AUTO', 'Hello مرحبا')).toBe('LTR')
    expect(resolveTextDirection('RTL', 'Hello')).toBe('RTL')
  })

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

    const surface = ck.MakeSurface(200, 50)!
    const renderer = new SkiaRendererClass(ck, surface)
    renderer.viewportWidth = 200
    renderer.viewportHeight = 50
    renderer.dpr = 1
    renderer.fontsLoaded = true
    renderer.fontProvider = fontProvider

    const canvas = surface.getCanvas()
    canvas.clear(ck.WHITE)
    renderText(renderer, canvas, graph.getNode(node.id)!)
    surface.flush()

    const image = surface.makeImageSnapshot()
    const encoded = image.encodeToBytes(ck.ImageFormat.PNG, 100)!
    image.delete()
    surface.delete()

    expect(encoded.length).toBeGreaterThan(200)

    const decodedImage = ck.MakeImageFromEncoded(encoded)!
    const pixels = decodedImage.readPixels(0, 0, {
      width: 200,
      height: 50,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    })!
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

    const surface = ck.MakeSurface(220, 80)!
    const renderer = new SkiaRendererClass(ck, surface)
    renderer.viewportWidth = 220
    renderer.viewportHeight = 80
    renderer.dpr = 1
    renderer.fontsLoaded = true
    renderer.fontProvider = fontProvider

    const canvas = surface.getCanvas()
    canvas.clear(ck.WHITE)
    renderer.renderShape(canvas, graph.getNode(node.id)!, graph)
    surface.flush()

    const image = surface.makeImageSnapshot()
    const pixels = image.readPixels(0, 0, {
      width: 220,
      height: 80,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    })!
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

    const surface = ck.MakeSurface(220, 60)!
    const renderer = new SkiaRendererClass(ck, surface)
    renderer.viewportWidth = 220
    renderer.viewportHeight = 60
    renderer.dpr = 1
    renderer.fontsLoaded = true
    renderer.fontProvider = fontProvider

    const canvas = surface.getCanvas()
    canvas.clear(ck.WHITE)
    renderText(renderer, canvas, graph.getNode(node.id)!)
    surface.flush()

    const image = surface.makeImageSnapshot()
    const encoded = image.encodeToBytes(ck.ImageFormat.PNG, 100)!
    image.delete()
    surface.delete()

    expect(encoded.length).toBeGreaterThan(200)

    const decodedImage = ck.MakeImageFromEncoded(encoded)!
    const pixels = decodedImage.readPixels(0, 0, {
      width: 220,
      height: 60,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    })!
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
