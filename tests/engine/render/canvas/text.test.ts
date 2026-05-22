import { describe, test, expect, mock } from 'bun:test'

import {
  detectTextDirection,
  resolveTextDirection,
  SceneGraph,
  SkiaRenderer as SkiaRendererClass
} from '@open-pencil/core'

import { initCanvasKit } from '#cli/headless'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { renderText } from '#core/canvas/scene'
import { buildParagraph } from '#core/canvas/text'
import type { SceneNode } from '#core/scene-graph'
import { fontManager } from '#core/text/fonts'

import { expectDefined } from '#tests/helpers/assert'
import { repoPath } from '#tests/helpers/paths'

import { createMockCanvas, createMockRenderer, mockCalls } from './helpers'

function createMockParagraph() {
  return { delete: mock(() => undefined) }
}

function createMockPicture() {
  return { delete: mock(() => undefined) }
}

function createMockTextRenderer(overrides: Partial<Record<string, unknown>> = {}) {
  const paragraph = createMockParagraph()
  const base = createMockRenderer()
  const renderer = createMockRenderer({
    fontsLoaded: true,
    fontProvider: {},
    textFont: {},
    buildParagraph: mock((_node: unknown, _color?: unknown) => paragraph),
    isNodeFontLoaded: mock(() => true),
    ck: {
      ...base.ck,
      MakePicture: mock(() => createMockPicture())
    } as SkiaRenderer['ck'],
    ...overrides
  })
  return Object.assign(renderer, { _paragraph: paragraph }) as typeof renderer & {
    _paragraph: ReturnType<typeof createMockParagraph>
  }
}

async function createTextRenderer() {
  const ck = await initCanvasKit()
  const surface = expectDefined(ck.MakeSurface(400, 120), 'surface')
  const renderer = new SkiaRendererClass(ck, surface)
  return { renderer, surface }
}

function textNode(overrides: Partial<SceneNode> = {}): SceneNode {
  return {
    text: 'Hello 你好',
    fontSize: 16,
    fontFamily: 'Arial',
    fontWeight: 400,
    italic: false,
    letterSpacing: 0,
    lineHeight: null,
    textAlignHorizontal: 'LEFT',
    textAlignVertical: 'TOP',
    textAutoResize: 'NONE',
    textDecoration: 'NONE',
    textDirection: 'AUTO',
    styleRuns: [],
    ...overrides
  } as SceneNode
}

describe('renderText', () => {
  test('uses buildParagraph when fonts are loaded and node font is available', () => {
    const r = createMockTextRenderer()
    const canvas = createMockCanvas()
    renderText(r, canvas as never, textNode())
    expect(r.buildParagraph).toHaveBeenCalledTimes(1)
    expect(canvas.drawParagraph).toHaveBeenCalledTimes(1)
    expect(canvas.drawText).not.toHaveBeenCalled()
    expect(r._paragraph.delete).toHaveBeenCalledTimes(1)
  })

  test('renders gradient text through a paragraph mask', () => {
    const r = createMockTextRenderer()
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
    const r = createMockTextRenderer()
    const canvas = createMockCanvas()
    const node = textNode({ textPicture: new Uint8Array([1, 2, 3]) })

    renderText(r, canvas as never, node)

    expect(canvas.drawPicture).toHaveBeenCalledTimes(1)
    expect(r.buildParagraph).not.toHaveBeenCalled()
  })

  test('falls back to drawText only when fonts are NOT loaded', () => {
    const r = createMockTextRenderer({ fontsLoaded: false, fontProvider: null })
    const canvas = createMockCanvas()

    renderText(r, canvas as never, textNode())

    expect(canvas.drawText).toHaveBeenCalledTimes(1)
    expect(r.buildParagraph).not.toHaveBeenCalled()
  })

  test('does nothing for empty text', () => {
    const r = createMockTextRenderer()
    const canvas = createMockCanvas()

    renderText(r, canvas as never, textNode({ text: '' }))

    expect(r.buildParagraph).not.toHaveBeenCalled()
    expect(canvas.drawText).not.toHaveBeenCalled()
    expect(canvas.drawPicture).not.toHaveBeenCalled()
  })

  test('text LOD uses the first visible fill for the gray rect color', () => {
    const r = createMockTextRenderer({
      zoom: 0.1,
      minScreenSizeForText: 100
    })
    const canvas = createMockCanvas()
    const fills = [
      { type: 'SOLID', visible: true, opacity: 0.25, color: { r: 1, g: 0, b: 0, a: 1 } },
      { type: 'SOLID', visible: true, opacity: 0.75, color: { r: 0, g: 0, b: 1, a: 1 } }
    ]

    renderText(
      r,
      canvas as never,
      textNode({
        width: 20,
        height: 10,
        fills
      }),
      fills[0] as never,
      true
    )

    expect(canvas.drawRect).toHaveBeenCalledTimes(1)
    expect(r._textLodCulledCount).toBe(1)
    const setColorCalls = mockCalls(r.auxFill.setColor as ReturnType<typeof mock>)
    expect(Array.from(setColorCalls.at(-1)?.[0] as Float32Array)).toEqual([1, 0, 0, 0.25])
  })

  test('text LOD skips drawRect for non-first fills (overdraw guard)', () => {
    const r = createMockTextRenderer({
      zoom: 0.1,
      minScreenSizeForText: 100
    })
    const canvas = createMockCanvas()
    const fills = [
      { type: 'SOLID', visible: true, opacity: 0.25, color: { r: 1, g: 0, b: 0, a: 1 } },
      { type: 'SOLID', visible: true, opacity: 0.75, color: { r: 0, g: 0, b: 1, a: 1 } }
    ]
    const node = textNode({
      width: 20,
      height: 10,
      fills
    })

    renderText(r, canvas as never, node, fills[1] as never, false)

    expect(canvas.drawRect).not.toHaveBeenCalled()
    expect(r._textLodCulledCount).toBe(0)
  })

  test('text LOD counts a multi-fill node once even when rendered for each fill', () => {
    const r = createMockTextRenderer({
      zoom: 0.1,
      minScreenSizeForText: 100
    })
    const canvas = createMockCanvas()
    const fills = [
      { type: 'SOLID', visible: true, opacity: 0.25, color: { r: 1, g: 0, b: 0, a: 1 } },
      { type: 'SOLID', visible: true, opacity: 0.75, color: { r: 0, g: 0, b: 1, a: 1 } }
    ]
    const node = textNode({
      width: 20,
      height: 10,
      fills
    })

    renderText(r, canvas as never, node, fills[0] as never, true)
    renderText(r, canvas as never, node, fills[1] as never, false)

    expect(r._textLodCulledCount).toBe(1)
  })

  test('text LOD only draws the gray rect once for multi-fill text (no overdraw)', () => {
    const r = createMockTextRenderer({
      zoom: 0.1,
      minScreenSizeForText: 100
    })
    const canvas = createMockCanvas()
    const fills = [
      { type: 'SOLID', visible: true, opacity: 0.5, color: { r: 1, g: 0, b: 0, a: 1 } },
      { type: 'SOLID', visible: true, opacity: 0.5, color: { r: 0, g: 1, b: 0, a: 1 } },
      { type: 'SOLID', visible: true, opacity: 0.5, color: { r: 0, g: 0, b: 1, a: 1 } }
    ]
    const node = textNode({
      width: 20,
      height: 10,
      fills
    })

    renderText(r, canvas as never, node, fills[0] as never, true)
    renderText(r, canvas as never, node, fills[1] as never, false)
    renderText(r, canvas as never, node, fills[2] as never, false)

    expect(canvas.drawRect).toHaveBeenCalledTimes(1)
    expect(r._textLodCulledCount).toBe(1)
  })

  test('text LOD does not crash on gradient fills (fallback to neutral gray)', () => {
    const r = createMockTextRenderer({
      zoom: 0.1,
      minScreenSizeForText: 100
    })
    const canvas = createMockCanvas()
    const gradientFill = {
      type: 'GRADIENT_LINEAR' as const,
      visible: true,
      opacity: 0.8,
      gradientStops: [
        { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
        { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
      ],
      gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    }
    const node = textNode({
      width: 20,
      height: 10,
      fills: [gradientFill]
    })

    expect(() => {
      renderText(r, canvas as never, node, gradientFill as never, true)
    }).not.toThrow()

    expect(canvas.drawRect).toHaveBeenCalledTimes(1)
    expect(r._textLodCulledCount).toBe(1)
    const setColorCalls = mockCalls(r.auxFill.setColor as ReturnType<typeof mock>)
    const lastSetColor = setColorCalls.at(-1)?.[0] as Float32Array
    expect(lastSetColor[0]).toBeCloseTo(0.5)
    expect(lastSetColor[1]).toBeCloseTo(0.5)
    expect(lastSetColor[2]).toBeCloseTo(0.5)
    expect(lastSetColor[3]).toBeCloseTo(0.8)
  })

  test('text LOD does not crash on image fills (fallback to neutral gray)', () => {
    const r = createMockTextRenderer({
      zoom: 0.1,
      minScreenSizeForText: 100
    })
    const canvas = createMockCanvas()
    const imageFill = {
      type: 'IMAGE' as const,
      visible: true,
      opacity: 0.6,
      imageHash: 'abc123',
      imageScaleMode: 'FILL' as const
    }
    const node = textNode({
      width: 20,
      height: 10,
      fills: [imageFill]
    })

    expect(() => {
      renderText(r, canvas as never, node, imageFill as never, true)
    }).not.toThrow()

    expect(canvas.drawRect).toHaveBeenCalledTimes(1)
    expect(r._textLodCulledCount).toBe(1)
    const setColorCalls = mockCalls(r.auxFill.setColor as ReturnType<typeof mock>)
    const lastSetColor = setColorCalls.at(-1)?.[0] as Float32Array
    expect(lastSetColor[0]).toBeCloseTo(0.5)
    expect(lastSetColor[1]).toBeCloseTo(0.5)
    expect(lastSetColor[2]).toBeCloseTo(0.5)
    expect(lastSetColor[3]).toBeCloseTo(0.6)
  })

  test('text LOD ignores fill-less effect/shadow passes (no gray rect in shadows)', () => {
    const r = createMockTextRenderer({
      zoom: 0.1,
      minScreenSizeForText: 100
    })
    const canvas = createMockCanvas()
    const fills = [{ type: 'SOLID', visible: true, opacity: 1, color: { r: 0, g: 0, b: 1, a: 1 } }]
    const node = textNode({
      width: 20,
      height: 10,
      fills
    })

    renderText(r, canvas as never, node)
    expect(r._textLodCulledCount).toBe(0)
    expect(canvas.drawRect).not.toHaveBeenCalled()
    expect(r.buildParagraph).toHaveBeenCalled()

    renderText(r, canvas as never, node, fills[0] as never, true)
    expect(r._textLodCulledCount).toBe(1)
    expect(canvas.drawRect).toHaveBeenCalledTimes(1)
  })
})

describe('paragraph font weights', () => {
  test('bold Inter paragraph is wider than regular Inter', async () => {
    const { renderer, surface } = await createTextRenderer()
    await renderer.loadFonts()
    const regular = await Bun.file(repoPath('public/Inter-Regular.ttf')).arrayBuffer()
    const bold = await Bun.file(repoPath('public/Inter-Bold.ttf')).arrayBuffer()
    fontManager.markLoaded('Inter', 'Regular', regular)
    fontManager.markLoaded('Inter', 'Bold', bold)

    const base = textNode({
      text: 'World largest design',
      fontFamily: 'Inter',
      fontSize: 64,
      width: 1000,
      height: 100,
      fontWeight: 400,
      italic: false
    })
    const regularParagraph = buildParagraph(renderer, base)
    const boldParagraph = buildParagraph(renderer, { ...base, fontWeight: 700 })

    expect(boldParagraph.getLongestLine()).toBeGreaterThan(regularParagraph.getLongestLine())
    regularParagraph.delete()
    boldParagraph.delete()
    surface.delete()
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
