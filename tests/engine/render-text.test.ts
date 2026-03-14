import { describe, test, expect, mock } from 'bun:test'
import { renderText } from '../../packages/core/src/renderer/scene'
import type { SceneNode } from '../../packages/core/src/scene-graph'
import type { SkiaRenderer } from '../../packages/core/src/renderer/renderer'
import { initCanvasKit } from '../../packages/cli/src/headless'
import { SceneGraph, SkiaRenderer as SkiaRendererClass } from '@open-pencil/core'
import { initFontService, setCJKFallbackFamily, markFontLoaded } from '../../packages/core/src/fonts'

function createMockCanvas() {
  return {
    drawParagraph: mock(() => {}),
    drawPicture: mock(() => {}),
    drawText: mock(() => {}),
    save: mock(() => {}),
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
    ck: {
      MakePicture: mock(() => createMockPicture()),
      LTRBRect: mock((...args: number[]) => args),
      ClipOp: { Intersect: 0 }
    },
    DEFAULT_FONT_SIZE: 14,
    isNodeFontLoaded: mock(() => true),
    buildParagraph: mock(() => paragraph),
    _paragraph: paragraph,
    ...overrides
  } as unknown as SkiaRenderer & { _paragraph: ReturnType<typeof createMockParagraph> }
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
  test('renders CJK text via fallback font through paragraph shaper', async () => {
    const ck = await initCanvasKit()
    const fontProvider = ck.TypefaceFontProvider.Make()
    initFontService(ck, fontProvider)

    const interData = await Bun.file('public/Inter-Regular.ttf').arrayBuffer()
    fontProvider.registerFont(interData, 'Inter')
    markFontLoaded('Inter', 'Regular', interData)

    const notoPath = new URL('../../tests/fixtures/fonts/NotoSansSC-Regular.ttf', import.meta.url).pathname
    const notoData = await Bun.file(notoPath).arrayBuffer()
    fontProvider.registerFont(notoData, 'Noto Sans SC')
    setCJKFallbackFamily('Noto Sans SC')

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
    ;(renderer as unknown as Record<string, unknown>).fontProvider = fontProvider

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
})
