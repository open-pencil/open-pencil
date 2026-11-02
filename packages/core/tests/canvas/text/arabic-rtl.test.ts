import { beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import type { Paragraph, Surface, TypefaceFontProvider } from 'canvaskit-wasm'

import { expectDefined } from '#core-tests/helpers/assert'
import { FIXTURES } from '#core-tests/helpers/paths'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { pixelLength } from '@open-pencil/scene-graph/text'
import {
  detectTextDirection,
  isLogicalTextAlignEnd,
  isLogicalTextAlignStart,
  resolveTextDirection
} from '@open-pencil/scene-graph/text/direction'

import { getCanvasKit } from '#core/canvaskit'
import { renderText } from '#core/canvas/scene'
import { buildParagraph } from '#core/canvas/text'
import { fontManager } from '#core/text/font/manager'

type CK = Awaited<ReturnType<typeof getCanvasKit>>

const ARABIC_FAMILY = 'Noto Naskh Arabic'
const W = 400
const H = 80

let ck: CK
let provider: TypefaceFontProvider

beforeAll(async () => {
  ck = await getCanvasKit()
  provider = ck.TypefaceFontProvider.Make()
  fontManager.attachProvider(ck, provider)
  const arabic = await Bun.file(join(FIXTURES, 'fonts', 'NotoNaskhArabic-Regular.ttf')).arrayBuffer()
  const inter = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
  provider.registerFont(arabic, ARABIC_FAMILY)
  provider.registerFont(inter, 'Inter')
  await fontManager.markLoaded(ARABIC_FAMILY, 'Regular', arabic)
  await fontManager.markLoaded('Inter', 'Regular', inter)
  fontManager.setArabicFallbackFamily(ARABIC_FAMILY)
})

function makeRenderer(): { renderer: SkiaRenderer; surface: Surface } {
  const surface = expectDefined(ck.MakeSurface(W, H), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  renderer.viewportWidth = W
  renderer.viewportHeight = H
  renderer.dpr = 1
  renderer.fontsLoaded = true
  renderer.fontProvider = provider
  return { renderer, surface }
}

function textNode(props: Partial<SceneNode>): SceneNode {
  const graph = new SceneGraph()
  const node = graph.createNode('TEXT', graph.getPages()[0].id, {
    fontFamily: ARABIC_FAMILY,
    fontSize: 32,
    fontWeight: 400,
    width: W,
    height: H,
    lineHeight: pixelLength(48),
    textAutoResize: 'NONE',
    textDirection: 'AUTO',
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
    ...props
  })
  return expectDefined(graph.getNode(node.id), 'text node')
}

function withParagraph<T>(props: Partial<SceneNode>, run: (p: Paragraph) => T): T {
  const { renderer, surface } = makeRenderer()
  const paragraph = buildParagraph(renderer, textNode(props))
  try {
    paragraph.layout(W)
    return run(paragraph)
  } finally {
    paragraph.delete()
    surface.delete()
  }
}

interface PlacedGlyph {
  /** UTF-16 index of the character the glyph belongs to. */
  index: number
  x: number
  glyph: number
}

/** Shaped glyphs in visual order. Skia reports UTF-8 byte offsets; map them back to UTF-16. */
function glyphs(p: Paragraph, text: string): PlacedGlyph[] {
  const byteToIndex = new Map<number, number>()
  let bytes = 0
  for (let i = 0; i < text.length; i++) {
    byteToIndex.set(bytes, i)
    const code = text.codePointAt(i) ?? 0
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
    if (code >= 0x10000) i++
  }
  const out: PlacedGlyph[] = []
  for (const line of p.getShapedLines())
    for (const run of line.runs)
      for (let i = 0; i < run.glyphs.length; i++)
        out.push({
          index: byteToIndex.get(run.offsets[i]) ?? -1,
          x: run.positions[i * 2],
          glyph: run.glyphs[i]
        })
  return out
}

/** The glyph ids drawn for each character (Naskh draws dots as separate glyphs). */
function glyphSets(text: string): string[] {
  return withParagraph({ text }, (p) => {
    const g = glyphs(p, text)
    return [...text].map((_, i) =>
      g
        .filter((x) => x.index === i)
        .map((x) => x.glyph)
        .sort((a, b) => a - b)
        .join(',')
    )
  })
}

function xOf(g: PlacedGlyph[], index: number): number {
  return expectDefined(g.find((x) => x.index === index), `glyph for character ${index}`).x
}

/** Leftmost and rightmost columns holding dark ink after rendering the node. */
function inkBounds(props: Partial<SceneNode>): { left: number; right: number; dark: number } {
  const { renderer, surface } = makeRenderer()
  const canvas = surface.getCanvas()
  canvas.clear(ck.WHITE)
  renderText(renderer, canvas, textNode(props))
  surface.flush()
  const image = surface.makeImageSnapshot()
  const pixels = expectDefined(
    image.readPixels(0, 0, {
      width: W,
      height: H,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    }),
    'pixels'
  )
  image.delete()
  surface.delete()
  let left = W
  let right = -1
  let dark = 0
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (pixels[(y * W + x) * 4] < 128) {
        dark++
        if (x < left) left = x
        if (x > right) right = x
      }
    }
  return { left, right, dark }
}

describe('Arabic direction detection', () => {
  test.each([
    ['مرحبا', 'RTL'],
    ['مرحبا world', 'RTL'],
    ['Hello مرحبا', 'LTR'],
    ['123 مرحبا', 'RTL'],
    ['«مرحبا»', 'RTL'],
    ['   ؟مرحبا', 'RTL'],
    ['سلام دوست', 'RTL'], // Persian
    ['شکریہ', 'RTL'], // Urdu
    ['שלום', 'RTL'], // Hebrew
    ['١٢٣', 'RTL'], // Arabic-Indic digits belong to the Arabic script
    ['', 'LTR']
  ] as const)('detects %p as %s', (text, expected) => {
    expect(detectTextDirection(text)).toBe(expected)
  })

  test('explicit direction overrides content', () => {
    expect(resolveTextDirection('RTL', 'Hello')).toBe('RTL')
    expect(resolveTextDirection('LTR', 'مرحبا')).toBe('LTR')
  })

  test('logical start and end follow the resolved direction', () => {
    const base = { textDirection: 'AUTO' as const, text: 'مرحبا' }
    expect(isLogicalTextAlignStart({ ...base, textAlignHorizontal: 'RIGHT' })).toBe(true)
    expect(isLogicalTextAlignEnd({ ...base, textAlignHorizontal: 'LEFT' })).toBe(true)
    expect(isLogicalTextAlignStart({ ...base, textAlignHorizontal: 'LEFT' })).toBe(false)
  })
})

describe('Arabic shaping', () => {
  const pangram = 'أبجد هوز حطي كلمن سعفص قرشت ثخذ ضظغ'

  test('every Arabic character resolves to a real glyph', () => {
    withParagraph({ text: pangram }, (p) => {
      const g = glyphs(p, pangram)
      expect(g.some((x) => x.glyph === 0)).toBe(false)
      for (let i = 0; i < pangram.length; i++)
        if (pangram[i] !== ' ') expect(g.some((x) => x.index === i)).toBe(true)
    })
  })

  test('letters take contextual forms: initial, medial, final and isolated beh all differ', () => {
    const [isolated] = glyphSets('ب')
    const [initial, medial, final] = glyphSets('ببب')
    expect(new Set([isolated, initial, medial, final]).size).toBe(4)
  })

  test('lam-alef joins: both letters differ from their isolated forms', () => {
    const [lam] = glyphSets('ل')
    const [alef] = glyphSets('ا')
    const [lamJoined, alefJoined] = glyphSets('لا')
    expect(lamJoined).not.toBe(lam)
    expect(alefJoined).not.toBe(alef)
  })

  test('non-joining alef leaves the following letter in initial form', () => {
    const [, initialBeh] = glyphSets('ابب')
    const [initial] = glyphSets('بب')
    expect(initialBeh).toBe(initial)
  })

  test('ZWNJ breaks joining so the first letter returns to isolated form', () => {
    const [isolated] = glyphSets('ب')
    const [joined] = glyphSets('بب')
    const [broken] = glyphSets('ب\u200cب')
    expect(joined).not.toBe(isolated)
    expect(broken).toBe(isolated)
  })

  test('tashkeel marks attach without adding advance width', () => {
    const plain = withParagraph({ text: 'كتب' }, (p) => p.getLongestLine())
    const voweled = withParagraph({ text: 'كَتَبَ' }, (p) => p.getLongestLine())
    expect(Math.abs(voweled - plain)).toBeLessThan(1)
  })

  test('tatweel stretches the word', () => {
    const plain = withParagraph({ text: 'كتب' }, (p) => p.getLongestLine())
    const long = withParagraph({ text: 'كـــتب' }, (p) => p.getLongestLine())
    expect(long).toBeGreaterThan(plain + 5)
  })
})

describe('Arabic bidi visual order', () => {
  test('first logical character is drawn rightmost in RTL text', () => {
    const text = 'سلام عليكم'
    withParagraph({ text }, (p) => {
      const g = glyphs(p, text)
      expect(xOf(g, 0)).toBeGreaterThan(xOf(g, text.length - 1))
      expect(xOf(g, 0)).toBe(Math.max(...g.map((x) => x.x)))
    })
  })

  test('Latin digits inside Arabic keep left-to-right order between the words', () => {
    const text = 'السعر 125 ريال'
    withParagraph({ text }, (p) => {
      const g = glyphs(p, text)
      const one = text.indexOf('1')
      expect(xOf(g, one)).toBeLessThan(xOf(g, one + 1))
      expect(xOf(g, one + 1)).toBeLessThan(xOf(g, one + 2))
      expect(xOf(g, one + 2)).toBeLessThan(xOf(g, 0))
      expect(xOf(g, one)).toBeGreaterThan(xOf(g, text.length - 1))
    })
  })

  test('Arabic-Indic digits keep left-to-right order too', () => {
    const text = 'العدد ١٢٣ هنا'
    withParagraph({ text }, (p) => {
      const g = glyphs(p, text)
      const first = text.indexOf('١')
      expect(xOf(g, first)).toBeLessThan(xOf(g, first + 1))
      expect(xOf(g, first + 1)).toBeLessThan(xOf(g, first + 2))
    })
  })

  test('embedded English word keeps LTR order inside an RTL paragraph', () => {
    const text = 'تطبيق Figma رائع'
    withParagraph({ text, fontFamily: 'Inter' }, (p) => {
      const g = glyphs(p, text)
      const f = text.indexOf('F')
      for (let i = f; i < f + 4; i++) expect(xOf(g, i)).toBeLessThan(xOf(g, i + 1))
      expect(xOf(g, f + 4)).toBeLessThan(xOf(g, 0))
      expect(xOf(g, f)).toBeGreaterThan(xOf(g, text.length - 1))
    })
  })

  test('explicit LTR direction orders runs left to right, Arabic run still reads RTL', () => {
    const text = 'سلام world'
    withParagraph({ text, textDirection: 'LTR', fontFamily: 'Inter' }, (p) => {
      const g = glyphs(p, text)
      expect(xOf(g, 0)).toBeLessThan(xOf(g, text.indexOf('w')))
      expect(xOf(g, 0)).toBeGreaterThan(xOf(g, 3))
    })
  })

  test('AUTO direction on the same text puts the Arabic word on the right', () => {
    const text = 'سلام world'
    withParagraph({ text, fontFamily: 'Inter' }, (p) => {
      const g = glyphs(p, text)
      expect(xOf(g, 0)).toBeGreaterThan(xOf(g, text.indexOf('w')))
    })
  })

  test('hit-testing the right edge of RTL text lands at the logical start', () => {
    const text = 'مرحبا بكم'
    withParagraph({ text, textAlignHorizontal: 'RIGHT' }, (p) => {
      expect(p.getGlyphPositionAtCoordinate(W - 1, 20).pos).toBe(0)
      expect(p.getGlyphPositionAtCoordinate(0, 20).pos).toBe(text.length)
    })
  })

  test('wrapped RTL paragraph keeps logical order across lines', () => {
    const text = 'هذا نص عربي طويل يجب أن ينكسر على أكثر من سطر واحد داخل الإطار'
    const { renderer, surface } = makeRenderer()
    const p = buildParagraph(renderer, textNode({ text }))
    p.layout(160)
    const lines = p.getShapedLines()
    expect(lines.length).toBeGreaterThan(2)
    for (let i = 1; i < lines.length; i++)
      expect(lines[i].textRange.first).toBeGreaterThanOrEqual(lines[i - 1].textRange.last)
    p.delete()
    surface.delete()
  })
})

describe('Arabic rendered pixels', () => {
  const text = 'مرحبا'

  test('renders visible ink', () => {
    expect(inkBounds({ text }).dark).toBeGreaterThan(150)
  })

  test('RIGHT alignment puts ink against the right edge', () => {
    const b = inkBounds({ text, textAlignHorizontal: 'RIGHT' })
    expect(b.right).toBeGreaterThan(W - 12)
    expect(b.left).toBeGreaterThan(W / 2)
  })

  test('LEFT alignment puts ink against the left edge', () => {
    const b = inkBounds({ text, textAlignHorizontal: 'LEFT' })
    expect(b.left).toBeLessThan(12)
    expect(b.right).toBeLessThan(W / 2)
  })

  test('RIGHT alignment also works for mixed Arabic and English', () => {
    const b = inkBounds({ text: 'مرحبا Hello', textAlignHorizontal: 'RIGHT' })
    expect(b.right).toBeGreaterThan(W - 12)
  })

  test('an explicitly RTL Latin line aligned RIGHT still hugs the right edge', () => {
    const b = inkBounds({ text: 'Hello', fontFamily: 'Inter', textDirection: 'RTL', textAlignHorizontal: 'RIGHT' })
    expect(b.right).toBeGreaterThan(W - 12)
  })

  test('CENTER alignment is balanced within 4px', () => {
    const b = inkBounds({ text, textAlignHorizontal: 'CENTER' })
    expect(Math.abs(b.left - (W - 1 - b.right))).toBeLessThanOrEqual(4)
  })
})

