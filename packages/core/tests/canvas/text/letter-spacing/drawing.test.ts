import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  ALIGNS,
  canvasKit,
  expectFigmaLines,
  figmaLines,
  figmaLineStart,
  laidOut,
  loadSpacedTextFonts,
  percent,
  pixels,
  releaseSpacedTextFonts,
  SENTENCE,
  type Case,
  type Props
} from '#core-tests/helpers/text/letter-spacing'

import type { Canvas, ShapedLine } from '@open-pencil/canvaskit'
import { expectDefined } from '@open-pencil/test-support/assert'
import { asDouble } from '@open-pencil/test-support/doubles'

beforeAll(loadSpacedTextFonts)
afterAll(releaseSpacedTextFonts)

const PAD = 8
const WIDTH = 133
const INK_TOLERANCE = 0.01

interface LineInk {
  middle: number
  total: number
}

function surfaceWidth(): number {
  return WIDTH + 2 * PAD
}

function drawn(height: number, draw: (canvas: Canvas) => void): ArrayLike<number> {
  const ck = canvasKit()
  const surface = expectDefined(ck.MakeSurface(surfaceWidth(), height), 'surface')
  try {
    const canvas = surface.getCanvas()
    canvas.clear(ck.WHITE)
    draw(canvas)
    return expectDefined(
      canvas.readPixels(0, 0, {
        width: surfaceWidth(),
        height,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'pixels'
    )
  } finally {
    surface.delete()
  }
}

/** The ink between each line's top and bottom, and its ink-weighted middle. */
function inkOf(pixels: ArrayLike<number>, lines: readonly ShapedLine[]): LineInk[] {
  return lines.map((line) => {
    let total = 0
    let moment = 0
    for (let y = Math.floor(line.top) + PAD; y < Math.ceil(line.bottom) + PAD; y++) {
      for (let x = 0; x < surfaceWidth(); x++) {
        const darkness = 255 - pixels[(y * surfaceWidth() + x) * 4]
        total += darkness
        moment += darkness * x
      }
    }
    return { middle: moment / total, total }
  })
}

/** Each line's glyphs drawn on their own, moved by `shifts`, on the baselines layout draws on. */
function drawGlyphs(canvas: Canvas, lines: readonly ShapedLine[], shifts: readonly number[]) {
  const ck = canvasKit()
  const paint = new ck.Paint()
  paint.setColor(ck.BLACK)
  paint.setAntiAlias(true)
  for (const [index, line] of lines.entries()) {
    const baseline = Math.round(line.baseline)
    for (const run of line.runs) {
      const font = new ck.Font(run.typeface, run.size)
      font.setSubpixel(true)
      font.setHinting(ck.FontHinting.Slight)
      font.setEdging(ck.FontEdging.AntiAlias)
      const positions = run.positions
        .slice(0, 2 * run.glyphs.length)
        .map((value, at) =>
          at % 2 === 0 ? value + shifts[index] + PAD : value - line.baseline + baseline + PAD
        )
      canvas.drawGlyphs(run.glyphs, positions, 0, 0, font, paint)
      font.delete()
    }
  }
  paint.delete()
}

const LENGTHENED_BY_CASE: Props = {
  text: 'Straße Straße Straße Straße Straße',
  textCase: 'UPPER',
  letterSpacing: pixels(8),
  styleRuns: [{ start: 14, length: 20, style: { letterSpacing: pixels(1) } }]
}

const BOXES: Case[] = [
  { label: 'upper case that lengthens a word, 8px then 1px', props: LENGTHENED_BY_CASE },
  { label: '3px', props: { text: SENTENCE, letterSpacing: pixels(3) } },
  {
    label: '3px, lines closer than their fonts',
    props: { text: SENTENCE, letterSpacing: pixels(3), lineHeight: percent(85) }
  },
  {
    label: '10%, hard lines',
    props: {
      text: 'Settings and more\noptions for everyone\nin the team',
      letterSpacing: percent(10)
    }
  },
  {
    label: 'first word 15%',
    props: {
      text: SENTENCE,
      styleRuns: [{ start: 0, length: 8, style: { letterSpacing: percent(15) } }]
    }
  },
  {
    label: 'base 10%, rest -8%',
    props: {
      text: SENTENCE,
      letterSpacing: percent(10),
      styleRuns: [{ start: 8, length: SENTENCE.length - 8, style: { letterSpacing: percent(-8) } }]
    }
  },
  {
    label: 'a word split inside, 10%',
    props: { text: 'Settings andmoreoptionsforeveryone in it', letterSpacing: percent(10) }
  },
  {
    label: 'marks above the font, line height 125%',
    props: { text: 'mmm mmm mmm mmm mmm ǺẪỖ', letterSpacing: pixels(10), lineHeight: percent(125) }
  },
  {
    label: 'marks above a word split inside, line height 125%',
    props: {
      text: 'ǺẪỖ ǺẪỖǺẪỖǺẪỖǺẪỖǺẪỖ gjpq ǺẪỖ',
      letterSpacing: percent(10),
      lineHeight: percent(125)
    }
  },
  {
    label: 'marks above lines starting apart, line height 85%',
    props: {
      text: 'ǺẪỖ ǺẪỖ gjpq ǺẪỖ gjpq ǺẪỖ gjpq ǺẪỖ',
      letterSpacing: percent(2),
      lineHeight: percent(85),
      styleRuns: [{ start: 0, length: 3, style: { letterSpacing: percent(20) } }]
    }
  }
]

const LINE_ALIGNS = ALIGNS.filter((align) => align !== 'JUSTIFIED')
const rows = BOXES.flatMap((testCase) =>
  LINE_ALIGNS.map((align) => [testCase.label, align, testCase] as const)
)

function boxed(props: Props, textAlignHorizontal: (typeof LINE_ALIGNS)[number]): Props {
  return { ...props, width: WIDTH, textAutoResize: 'HEIGHT', textAlignHorizontal }
}

describe('every line is drawn once, where Figma aligns it', () => {
  test.each(rows)('%s, %s: ink lands where the glyphs do', (_, align, { props }) => {
    const box = boxed(props, align)
    const layout = laidOut(box)
    const lines = layout.getShapedLines()
    const height = Math.ceil(layout.getHeight()) + 2 * PAD
    const toFigma = figmaLines(box, layout).map(
      (line) => figmaLineStart(align, line, WIDTH) - line.start
    )
    const layoutInk = inkOf(
      drawn(height, (canvas) => layout.draw(canvas, PAD, PAD)),
      lines
    )
    const figmaInk = inkOf(
      drawn(height, (canvas) => drawGlyphs(canvas, lines, toFigma)),
      lines
    )
    layout.delete()
    expect(lines.length).toBeGreaterThan(1)
    for (const [index, ink] of layoutInk.entries()) {
      expect(ink.middle).toBeCloseTo(figmaInk[index].middle, 1)
      expect(Math.abs(ink.total / figmaInk[index].total - 1)).toBeLessThan(INK_TOLERANCE)
    }
  })

  test.each(rows)(
    '%s, %s: the caret and a click land on the glyphs of each line',
    (_, align, { props }) => {
      const layout = laidOut(boxed(props, align))
      const lines = layout.getShapedLines()
      const metrics = layout.getLineMetrics()
      for (const [index, line] of lines.entries()) {
        const start = metrics[index].startIndex
        const firstGlyph = Math.min(...line.runs.map((run) => run.positions[0]))
        const caret = expectDefined(layout.getCaretRect(start, false), 'caret')
        const hit = layout.getGlyphPositionAtCoordinate(firstGlyph + 1, line.baseline)
        expect(caret.x).toBeCloseTo(firstGlyph, 2)
        expect(hit.pos).toBe(start)
      }
      layout.delete()
    }
  )
})

describe('lines moved apart without pieces of their own', () => {
  interface DrawCall {
    x: number
    top: number
    bottom: number
  }

  function recordedDraws(draw: (canvas: Canvas) => void): DrawCall[] {
    const calls: DrawCall[] = []
    const open = { top: -Infinity, bottom: Infinity }
    let clip = open
    draw(
      asDouble<Canvas>({
        save: () => undefined,
        restore: () => {
          clip = open
        },
        clipRect: (rect: Float32Array) => {
          clip = { top: rect[1], bottom: rect[3] }
        },
        drawParagraph: (_: unknown, x: number) => {
          calls.push({ x, ...clip })
        }
      })
    )
    return calls
  }

  test.each([
    ['line height 100%', percent(100)],
    ['lines overlapping, 50%', percent(50)]
  ] as const)('%s: each line is drawn where Figma aligns it and layout says', (_, lineHeight) => {
    const box = boxed({ ...LENGTHENED_BY_CASE, lineHeight }, 'RIGHT')
    const layout = laidOut(box)
    expectFigmaLines('RIGHT', figmaLines(box, layout), WIDTH)
    const calls = recordedDraws((canvas) => layout.draw(canvas, 0, 0))
    const [block] = layout.blocks
    for (const [index, line] of layout.getLineMetrics().entries()) {
      const own = block.metrics[index]
      const middle = own.baseline - own.ascent / 2
      const call = expectDefined(
        calls.find(({ top, bottom }) => middle >= top && middle < bottom),
        `line ${index} drawn`
      )
      expect(call.x).toBeCloseTo(line.left - own.left, 2)
    }
    layout.delete()
  })
})
