import { afterAll, describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import {
  type DerivedTextGlyph,
  type Effect,
  SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { buildParagraph, textVerticalOffset } from '#core/canvas/text'
import { savedTextInk } from '#core/canvas/text/ink'
import { laidOutGlyphs } from '#core/canvas/text/placed'
import { shownText } from '#core/text/case'
import { fontManager } from '#core/text/font/manager'
import { withTextInkMeasurer } from '#core/text/ink'
import { repoPath } from '@open-pencil/test-support/paths'

const SIZE = 128
const FONT_SIZE = 20
const BOX = { x: 40, y: 50, width: 40, height: 20 }
const MOVE_TO = 1
const LINE_TO = 2
const CLOSE = 0
const GLYPH_BOTTOM_EMS = -0.25
const GLYPH_TOP_EMS = 1.25
const LARGE_SIZE = 32
const ARABIC_FAMILY = 'Noto Naskh Arabic'
const ARABIC_WORD = '\u0628\u062C'
const SHORT_LINE = { value: 50, unit: 'PERCENT' as const }

const ck = await initCanvasKit()
const loading = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(SIZE, SIZE), 'surface'))
const loaded = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(SIZE, SIZE), 'surface'))
await loaded.loadFonts()
await fontManager.markLoaded(
  ARABIC_FAMILY,
  'Regular',
  await Bun.file(repoPath('packages/core/assets/NotoNaskhArabic-Regular.ttf')).arrayBuffer()
)
fontManager.setArabicFallbackFamily(ARABIC_FAMILY)
afterAll(() => {
  loading.destroy()
  loaded.destroy()
})

function rectangleCommandsBlob(bottom: number, top: number): Uint8Array {
  const points = [
    [0, bottom],
    [1, bottom],
    [1, top],
    [0, top]
  ]
  const blob = new Uint8Array(points.length * 9 + 1)
  const view = new DataView(blob.buffer)
  for (const [index, [x, y]] of points.entries()) {
    const offset = index * 9
    blob[offset] = index === 0 ? MOVE_TO : LINE_TO
    view.setFloat32(offset + 1, x, true)
    view.setFloat32(offset + 5, y, true)
  }
  blob[points.length * 9] = CLOSE
  return blob
}

function savedGlyph(placement: Partial<DerivedTextGlyph> = {}): DerivedTextGlyph {
  return {
    commandsBlob: rectangleCommandsBlob(GLYPH_BOTTOM_EMS, GLYPH_TOP_EMS),
    x: 0,
    y: BOX.height,
    fontSize: FONT_SIZE,
    firstCharacter: 0,
    ...placement
  }
}

const black = { type: 'SOLID' as const, color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }

const trimmedWithoutItsFont: Partial<SceneNode> = {
  text: 'A',
  fontSize: FONT_SIZE,
  fontFamily: 'Saved Glyphs Only',
  leadingTrim: 'CAP_HEIGHT',
  textAutoResize: 'WIDTH_AND_HEIGHT',
  derivedTextHeight: null,
  derivedTextGlyphs: [savedGlyph()]
}

const onAPathOverItsBox: Partial<SceneNode> = {
  text: 'A',
  fontSize: FONT_SIZE,
  fontFamily: 'Inter',
  textPathData: {
    network: { vertices: [], segments: [], regions: [] },
    normalizedSize: { x: BOX.width, y: BOX.height },
    tValue: 0,
    forward: true
  },
  derivedTextGlyphs: [savedGlyph({ y: -10, rotation: Math.PI / 2 })]
}

function dropShadow(drop: number): Effect {
  return {
    type: 'DROP_SHADOW',
    color: { r: 0, g: 0, b: 0, a: 1 },
    offset: { x: 0, y: drop },
    radius: 0,
    spread: 0,
    visible: true
  }
}

function inkedExtent(target: SkiaRenderer, props: Partial<SceneNode>, opacity: number) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  graph.createNode('TEXT', page.id, { ...BOX, fills: [black], ...props, opacity })
  target.pageId = page.id
  const canvas = target.surface.getCanvas()
  canvas.clear(ck.TRANSPARENT)
  withTextInkMeasurer(
    (node) => target.measureTextInk(node),
    () => target.renderSceneToCanvas(canvas, graph, page.id)
  )
  target.surface.flush()
  const image = target.surface.makeImageSnapshot()
  try {
    const rgba = expectDefined(
      image.readPixels(0, 0, {
        width: SIZE,
        height: SIZE,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      })
    )
    const extent = { minX: SIZE, minY: SIZE, maxX: -1, maxY: -1, pixels: 0 }
    for (let pixel = 0; pixel < SIZE * SIZE; pixel++) {
      if (rgba[pixel * 4 + 3] === 0) {
        continue
      }
      const x = pixel % SIZE
      const y = Math.floor(pixel / SIZE)
      extent.pixels++
      extent.minX = Math.min(extent.minX, x)
      extent.minY = Math.min(extent.minY, y)
      extent.maxX = Math.max(extent.maxX, x)
      extent.maxY = Math.max(extent.maxY, y)
    }
    return extent
  } finally {
    image.delete()
  }
}

function liveText(props: Partial<SceneNode>): Partial<SceneNode> {
  return { fontFamily: 'Inter', fontSize: LARGE_SIZE, lineHeight: SHORT_LINE, ...props }
}

const drawnCases: Array<[string, SkiaRenderer, Partial<SceneNode>]> = [
  ['trimmed text whose font is missing', loaded, trimmedWithoutItsFont],
  ['trimmed text whose fonts are still loading', loading, trimmedWithoutItsFont],
  ['letters set on a path over the box', loaded, onAPathOverItsBox],
  [
    'a flipped saved glyph',
    loaded,
    { ...trimmedWithoutItsFont, derivedTextGlyphs: [savedGlyph({ x: 30, scaleX: -1, scaleY: -1 })] }
  ],
  [
    'the drop shadow of a saved descender',
    loaded,
    { ...trimmedWithoutItsFont, effects: [dropShadow(10)] }
  ],
  [
    'the outside stroke of reflowed path text',
    loaded,
    {
      ...onAPathOverItsBox,
      textPathBox: { ...BOX },
      strokeGeometry: [],
      strokes: [{ ...black, weight: 4, align: 'OUTSIDE' }]
    }
  ],
  [
    'an upper-cased sharp s',
    loaded,
    liveText({ x: 2, width: SIZE - 4, text: '\u00DF\u00DF\n\u0105\u0105', textCase: 'UPPER' })
  ],
  ...(['UNDERLINE', 'STRIKETHROUGH'] as const).map(
    (textDecoration): [string, SkiaRenderer, Partial<SceneNode>] => [
      `the ${textDecoration.toLowerCase()} of text whose font is missing`,
      loaded,
      {
        ...trimmedWithoutItsFont,
        text: 'AA',
        textDecoration,
        derivedTextGlyphs: [0, 1].map((index) =>
          savedGlyph({
            commandsBlob: rectangleCommandsBlob(0, GLYPH_TOP_EMS),
            x: index * FONT_SIZE,
            firstCharacter: index
          })
        )
      }
    ]
  ),
  ['Arabic in its own family', loaded, liveText({ text: ARABIC_WORD, fontFamily: ARABIC_FAMILY })],
  ['Arabic drawn in a fallback face', loaded, liveText({ text: `A${ARABIC_WORD}` })],
  ...(
    [
      ['a fatha in a fallback face', 'Inter', 'A\u0628\u064E'],
      ['a kasra in a fallback face', 'Inter', 'A\u0628\u0650'],
      ['vowel marks in their own family', ARABIC_FAMILY, '\u0628\u064E\u062C\u0650']
    ] as const
  ).map(([name, fontFamily, text]): [string, SkiaRenderer, Partial<SceneNode>] => [
    `Arabic with ${name}`,
    loaded,
    { fontFamily, fontSize: FONT_SIZE, text }
  ])
]

describe('text ink', () => {
  test('places each outline as the canvas draws it', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', graph.getPages()[0].id, trimmedWithoutItsFont)
    expect(savedTextInk(loaded, node)).toEqual({
      minX: 0,
      minY: BOX.height - GLYPH_TOP_EMS * FONT_SIZE,
      maxX: FONT_SIZE,
      maxY: BOX.height - GLYPH_BOTTOM_EMS * FONT_SIZE
    })
  })

  test('keeps a flipped outline the right way round', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', graph.getPages()[0].id, {
      ...trimmedWithoutItsFont,
      derivedTextGlyphs: [savedGlyph({ scaleX: -1, scaleY: -1 })]
    })
    expect(savedTextInk(loaded, node)).toEqual({
      minX: -FONT_SIZE,
      minY: BOX.height + GLYPH_BOTTOM_EMS * FONT_SIZE,
      maxX: 0,
      maxY: BOX.height + GLYPH_TOP_EMS * FONT_SIZE
    })
  })

  test('measures every character of a right-to-left run', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', graph.getPages()[0].id, {
      ...BOX,
      ...liveText({ text: ARABIC_WORD, fontFamily: ARABIC_FAMILY })
    })
    const layout = buildParagraph(loaded, node, undefined, { halfLeading: true })
    try {
      const text = shownText(node)
      const glyphs = expectDefined(
        laidOutGlyphs(node, layout, text, textVerticalOffset(node, layout.getHeight()))
      )
      const measured = new Set(glyphs.map((glyph) => glyph.firstCharacter))
      expect([...measured].sort()).toEqual([0, 1])
    } finally {
      layout.delete()
    }
  })

  test.each(drawnCases)('keeps %s inside its opacity layer', (_, target, props) => {
    const opaque = inkedExtent(target, props, 1)
    expect(opaque.pixels).toBeGreaterThan(0)
    expect(inkedExtent(target, props, 0.5)).toEqual(opaque)
  })
})
