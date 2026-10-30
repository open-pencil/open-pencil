import { beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { expectDefined } from '#core-tests/helpers/assert'
import { FIXTURES } from '#core-tests/helpers/paths'
import type { TypefaceFontProvider } from 'canvaskit-wasm'

import type { ShapedText } from '@open-pencil/fig/node-change'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'
import { pixelLength } from '@open-pencil/scene-graph/text'

import { withFigExportRuntime, withTextShaper } from '#core/canvas/text/shape'
import { getCanvasKit } from '#core/canvaskit'
import { EMOJI_METRICS_FAMILY } from '#core/text/emoji'
import { fontManager } from '#core/text/font/manager'
import { getGlyphOutlineMetricsSync } from '#core/text/font/glyphs'

const testFont = (name: string) => join(FIXTURES, 'fonts', name)

const SENTENCE = 'A sentence long enough that it has to wrap onto a second line.'

async function shape(props: Partial<SceneNode>): Promise<ShapedText | null> {
  const graph = new SceneGraph()
  const node = graph.createNode('TEXT', graph.getPages()[0].id, {
    fontFamily: 'Inter',
    fontSize: 13,
    lineHeight: pixelLength(16),
    width: 230,
    height: 32,
    textAutoResize: 'HEIGHT',
    ...props
  })
  return withFigExportRuntime(graph, await getCanvasKit(), async (runtime) =>
    runtime.shapeText(node)
  )
}

// Every test here shapes Inter, in whatever order they run.
beforeAll(async () => {
  const inter = expectDefined(
    await fontManager.fetchBundledFont('/InterVariable.ttf'),
    'bundled Inter font'
  )
  await fontManager.markLoaded('Inter', 'Regular', inter)
})

describe('text shaping for saved glyphs', () => {
  /**
   * Figma saves every emoji as a 1 em square, a joined sequence or a flag as one: the layout
   * falls back to the emoji metrics font for them, which gives them that width.
   */
  test('lays an emoji out 1 em wide, a joined sequence and a flag as one', async () => {
    const metrics = expectDefined(
      await fontManager.fetchBundledFont('/OpenPencilEmojiMetrics-Regular.ttf'),
      'bundled emoji metrics font'
    )
    await fontManager.markLoaded(EMOJI_METRICS_FAMILY, 'Regular', metrics)
    const family = '👨‍👩‍👧‍👦'
    const shaped = expectDefined(
      await shape({ text: `a😀${family}🇺🇸b`, fontSize: 40, width: 400, textAutoResize: 'NONE' }),
      'shaped text'
    )
    const advance = (character: number) =>
      shaped.glyphs.find((glyph) => glyph.firstCharacter === character)?.advance
    expect([advance(1), advance(3), advance(3 + family.length)]).toEqual([40, 40, 40])
  })

  /**
   * Figma draws a saved emoji from its code points over a placeholder square 1 em wide, from
   * 0.07 em below the baseline, and saves ☺ with the selector for its emoji form; measured in
   * Figma desktop. The other glyphs keep their outlines.
   */
  test('saves an emoji as Figma does: a placeholder square with its code points', async () => {
    const metrics = expectDefined(
      await fontManager.fetchBundledFont('/OpenPencilEmojiMetrics-Regular.ttf'),
      'bundled emoji metrics font'
    )
    await fontManager.markLoaded(EMOJI_METRICS_FAMILY, 'Regular', metrics)
    const shaped = expectDefined(
      await shape({ text: 'a😀☺©', fontSize: 40, width: 400, textAutoResize: 'NONE' }),
      'shaped text'
    )
    const glyph = (character: number) =>
      expectDefined(
        shaped.glyphs.find((candidate) => candidate.firstCharacter === character),
        `glyph ${character}`
      )
    expect(glyph(1).emojiCodePoints).toEqual([0x1f600])
    expect(glyph(3).emojiCodePoints).toEqual([0x263a, 0xfe0f])
    const square = (glyph(1).commands ?? []).map(({ type, x, y }) => [type, x, y?.toFixed(2)])
    expect(square).toEqual([
      ['M', 0, '2.80'],
      ['L', 40, '2.80'],
      ['L', 40, '-37.20'],
      ['L', 0, '-37.20'],
      ['L', 0, '2.80'],
      ['Z', undefined, undefined]
    ])
    for (const character of [0, 4]) {
      expect(glyph(character).emojiCodePoints).toBeUndefined()
      expect(glyph(character).commands?.length).toBeGreaterThan(1)
    }
  })

  /**
   * Figma draws pasted or saved text only from the glyph outlines written for it. A character no
   * font has is shaped as the font's missing glyph; it must not cost the other characters their
   * outlines, or Figma shows the text blank. Checked by pasting into Figma desktop.
   */
  test('outlines every glyph of text with a character no font has', async () => {
    const shaped = expectDefined(
      await shape({ text: 'Tamil \u0b86 ok', fontSize: 40, width: 400, textAutoResize: 'NONE' }),
      'shaped text'
    )
    expect(shaped.glyphs.every((glyph) => glyph.commands !== null)).toBe(true)
  })

  /**
   * Figma draws a keycap as the text font's character with Noto Sans Symbols' keycap frame
   * after it: no advance, centred where the character ends, from 0.01 em below the baseline to
   * 0.83 em above. Measured from a keycap Figma saved.
   */
  test('saves a keycap as Figma does: the character, then the frame around it', async () => {
    const shaped = expectDefined(
      await shape({ text: 'Key 1\ufe0f\u20e3', fontSize: 100, width: 600, textAutoResize: 'NONE' }),
      'shaped text'
    )
    expect(shaped.glyphs.every((glyph) => glyph.commands !== null)).toBe(true)
    const frame = expectDefined(
      shaped.glyphs.find((glyph) => glyph.firstCharacter === 6),
      'keycap frame glyph'
    )
    const digit = expectDefined(
      shaped.glyphs.find((glyph) => glyph.firstCharacter === 4),
      'keycap digit glyph'
    )
    const bounds = (axis: 'x' | 'y') => {
      const values = (frame.commands ?? []).flatMap((command) =>
        command[axis] === undefined ? [] : [command[axis]]
      )
      return [Math.min(...values), Math.max(...values)].map((value) => Number(value.toFixed(2)))
    }
    expect(frame.advance).toBe(0)
    expect(frame.x).toBeCloseTo(digit.x + digit.advance, 3)
    expect(bounds('x')).toEqual([-42.2, 42.2])
    expect(bounds('y')).toEqual([-83.2, 1])
  })

  /** An emoji sequence the font does not join is several glyphs; Figma gets the emoji once. */
  test('saves an unjoined emoji sequence once, at its first glyph', async () => {
    const metrics = expectDefined(
      await fontManager.fetchBundledFont('/OpenPencilEmojiMetrics-Regular.ttf'),
      'bundled emoji metrics font'
    )
    await fontManager.markLoaded(EMOJI_METRICS_FAMILY, 'Regular', metrics)
    const sequence = '\u{1f469}\u200d\u{1f9af}\u200d\u{1f4bb}'
    const shaped = expectDefined(
      await shape({ text: `x${sequence}x`, fontSize: 40, width: 400, textAutoResize: 'NONE' }),
      'shaped text'
    )
    const emoji = shaped.glyphs.filter((glyph) => glyph.emojiCodePoints)
    expect(emoji.map((glyph) => glyph.firstCharacter)).toEqual([1])
    expect(emoji[0]?.emojiCodePoints).toEqual(Array.from(sequence, (c) => c.codePointAt(0) ?? 0))
    expect(shaped.glyphs.length).toBeGreaterThan(3)
    expect(shaped.glyphs.every((glyph) => glyph.commands !== null)).toBe(true)
  })

  /**
   * Glyphs come in visual order, so in right-to-left text a letter before an emoji can follow
   * it; that letter keeps its outline.
   */
  test('keeps the outlines of letters an emoji precedes in right-to-left text', async () => {
    const metrics = expectDefined(
      await fontManager.fetchBundledFont('/OpenPencilEmojiMetrics-Regular.ttf'),
      'bundled emoji metrics font'
    )
    await fontManager.markLoaded(EMOJI_METRICS_FAMILY, 'Regular', metrics)
    const shaped = expectDefined(
      await shape({
        text: '\u05d0\u{1f600}\u05d1',
        textDirection: 'RTL',
        fontSize: 40,
        width: 400,
        textAutoResize: 'NONE'
      }),
      'shaped text'
    )
    // Inter has no Hebrew: each letter is the missing glyph's box, an outline all the same.
    for (const character of [0, 3]) {
      const glyph = shaped.glyphs.find((candidate) => candidate.firstCharacter === character)
      expect(glyph?.commands?.length).toBeGreaterThan(1)
    }
  })

  /**
   * Characters the shaper draws as nothing, tag characters among them, take two UTF-16 units
   * past the Basic Multilingual Plane; they must not cost the letters around them their outlines.
   */
  test('outlines letters beside a tag sequence and a supplementary tag character', async () => {
    const metrics = expectDefined(
      await fontManager.fetchBundledFont('/OpenPencilEmojiMetrics-Regular.ttf'),
      'bundled emoji metrics font'
    )
    await fontManager.markLoaded(EMOJI_METRICS_FAMILY, 'Regular', metrics)
    const scotland = '\u{1f3f4}\u{e0067}\u{e0062}\u{e0073}\u{e0063}\u{e0074}\u{e007f}'
    const shaped = expectDefined(
      await shape({
        text: `Flag ${scotland} a\u{e0001}b`,
        fontSize: 40,
        width: 600,
        textAutoResize: 'NONE'
      }),
      'shaped text'
    )
    expect(shaped.glyphs.every((glyph) => glyph.commands !== null)).toBe(true)
    expect(shaped.glyphs.find((glyph) => glyph.emojiCodePoints)?.emojiCodePoints).toEqual(
      Array.from(scotland, (c) => c.codePointAt(0) ?? 0)
    )
  })

  test('breaks lines at the layer width (#914)', async () => {
    const shaped = expectDefined(await shape({ text: SENTENCE }), 'shaped text')
    const [first, second] = shaped.baselines

    expect(shaped.baselines).toHaveLength(2)
    expect(second.firstCharacter).toBe(first.endCharacter)
    expect(second.position.y - first.position.y).toBe(16)
    for (const glyph of shaped.glyphs) {
      expect(glyph.x + glyph.advance).toBeLessThanOrEqual(230.5)
      expect([first.position.y, second.position.y]).toContain(glyph.y)
    }
    expect(shaped.logicalIndexToCharacterOffsetMap).toHaveLength(SENTENCE.length)
    expect(shaped.logicalIndexToCharacterOffsetMap[second.firstCharacter]).toBe(0)
  })

  test('saves text with blank lines and a closing newline, which shaping leaves out', async () => {
    // Figma draws pasted text only from its saved glyphs, so a text without them is blank.
    const blank = expectDefined(await shape({ text: 'one\n\nthree' }), 'text with a blank line')
    expect(blank.baselines.map((line) => [line.firstCharacter, line.endCharacter])).toEqual([
      [0, 4],
      [4, 5],
      [5, 10]
    ])
    const [first, , third] = blank.baselines.map((line) => line.position.y)
    expect(blank.glyphs.map((glyph) => [glyph.firstCharacter, glyph.y])).toEqual([
      [0, first],
      [1, first],
      [2, first],
      [5, third],
      [6, third],
      [7, third],
      [8, third],
      [9, third]
    ])

    const closing = expectDefined(await shape({ text: 'one\n' }), 'text ending in a newline')
    expect(closing.baselines).toHaveLength(2)
    expect(closing.glyphs).toHaveLength(3)
  })

  test('places lines by horizontal and vertical alignment', async () => {
    const top = expectDefined(await shape({ text: 'Centered', height: 64 }), 'top')
    const centered = expectDefined(
      await shape({
        text: 'Centered',
        height: 64,
        textAlignHorizontal: 'CENTER',
        textAlignVertical: 'CENTER'
      }),
      'centered'
    )
    const line = centered.baselines[0]

    expect(line.position.x).toBeCloseTo((230 - line.width) / 2, 1)
    expect(centered.glyphs[0].x).toBeCloseTo(line.position.x, 3)
    expect(line.position.y - top.baselines[0].position.y).toBe(24)
  })

  test('draws each glyph the shaper chose, such as a contextual arrow', async () => {
    const shaped = expectDefined(await shape({ text: 'a->b' }), 'shaped text')
    const arrow = expectDefined(
      shaped.glyphs.find((glyph) => glyph.firstCharacter === 1),
      'arrow glyph'
    )
    const hyphen = expectDefined(getGlyphOutlineMetricsSync('Inter', 'Regular', '-', 13)?.[0])

    expect(shaped.glyphs).toHaveLength(3)
    expect(arrow.commands).not.toEqual(hyphen.commands)
    expect(shaped.logicalIndexToCharacterOffsetMap[2]).toBe(arrow.x)
  })

  test('outlines text whose font is not loaded in the font that drew it instead', async () => {
    // The canvas draws it in the default font, and Figma shows nothing for glyphs without outlines.
    const shaped = expectDefined(
      await shape({ text: 'Missing', fontFamily: 'Missing Font' }),
      'shaped text'
    )
    const first = expectDefined(shaped.glyphs[0]?.commands, 'outline')

    expect(shaped.glyphs.every((glyph) => glyph.commands !== null)).toBe(true)
    expect(first).toEqual(
      expectDefined(getGlyphOutlineMetricsSync('Inter', 'Regular', 'M', 13)?.[0]).commands
    )
  })

  test('keeps outlines for decorations across lines, which Figma draws from saved rects', async () => {
    const shaped = expectDefined(
      await shape({ text: SENTENCE, textDecoration: 'UNDERLINE' }),
      'shaped text'
    )

    expect(shaped.baselines).toHaveLength(2)
    expect(shaped.glyphs.every((glyph) => glyph.commands !== null)).toBe(true)
  })

  test('saves truncated text as the characters it shows and the ellipsis after them', async () => {
    // Figma draws pasted text only from its saved glyphs, so truncated text needs them too.
    const shaped = expectDefined(
      await shape({ text: SENTENCE, textTruncation: 'ENDING', height: 16, textAutoResize: 'NONE' }),
      'shaped text'
    )
    const ellipsis = expectDefined(shaped.glyphs.at(-1), 'ellipsis')

    expect(shaped.baselines).toHaveLength(1)
    expect(shaped.glyphs.every((glyph) => glyph.commands !== null)).toBe(true)
    expect(ellipsis.firstCharacter).toBeUndefined()
    const shown = shaped.glyphs.slice(0, -1)
    expect(shown.every((glyph) => (glyph.firstCharacter ?? Infinity) < SENTENCE.length)).toBe(true)
  })

  test('outlines characters a fallback font draws from that font', async () => {
    const fallbackFamilies = fontManager.getCJKFallbackFamilies()
    const originalFallbacks = [...fallbackFamilies]
    fallbackFamilies.length = 0
    try {
      const cjk = await Bun.file(testFont('NotoSansCJK-Test.otf')).arrayBuffer()
      await fontManager.markLoaded('Shape Test CJK', 'Regular', cjk)
      fontManager.setCJKFallbackFamily('Shape Test CJK')
      const shaped = expectDefined(await shape({ text: 'Hi 你好' }), 'shaped text')
      const ni = expectDefined(
        shaped.glyphs.find((glyph) => glyph.firstCharacter === 3),
        'glyph of 你'
      )

      expect(shaped.glyphs.every((glyph) => glyph.commands !== null)).toBe(true)
      expect(ni.commands).toEqual(
        expectDefined(getGlyphOutlineMetricsSync('Shape Test CJK', 'Regular', '你', 13)?.[0])
          .commands
      )
    } finally {
      fallbackFamilies.splice(0, fallbackFamilies.length, ...originalFallbacks)
    }
  })

  test('outlines a variable font at the instance the text is set in', async () => {
    const variable = await Bun.file(testFont('InterVariable-Latin.ttf')).arrayBuffer()
    await fontManager.markLoaded('Shape Test Variable', 'Bold', variable)
    const shaped = expectDefined(
      await shape({ text: 'l', fontFamily: 'Shape Test Variable', fontWeight: 700 }),
      'shaped text'
    )
    const bold = expectDefined(shaped.glyphs[0]?.commands, 'bold outline')
    const regular = expectDefined(
      getGlyphOutlineMetricsSync('Shape Test Variable', 'Bold', 'l', 13)?.[0]
    ).commands

    // The default instance is the regular weight; the bold stem is wider.
    const width = (commands: readonly { x?: number }[]) => {
      const xs = commands.flatMap((command) => (command.x === undefined ? [] : [command.x]))
      return Math.max(...xs) - Math.min(...xs)
    }
    expect(width(bold)).toBeGreaterThan(width(regular) * 1.2)
  })
})

test('overlapping shaping calls share their provider until the last one finishes', async () => {
  const ck = await getCanvasKit()
  // Providers other tests left attached are set aside, so the calls make one of their own.
  const setAside: TypefaceFontProvider[] = []
  for (
    let provider = fontManager.providerFor(ck);
    provider;
    provider = fontManager.providerFor(ck)
  ) {
    setAside.push(provider)
    fontManager.detachProvider(provider)
  }
  try {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'Shaped',
      fontFamily: 'Inter',
      fontSize: 13
    })
    const firstHeld = Promise.withResolvers<undefined>()
    const secondHeld = Promise.withResolvers<undefined>()

    const first = withTextShaper(ck, () => firstHeld.promise)
    const second = withTextShaper(ck, async (shape) => {
      await secondHeld.promise
      return shape(node)
    })
    firstHeld.resolve(undefined)
    await first
    secondHeld.resolve(undefined)

    expect((await second)?.baselines).toHaveLength(1)
    expect(fontManager.providerFor(ck)).toBeNull()
  } finally {
    for (const provider of setAside.toReversed()) fontManager.attachProvider(ck, provider)
  }
})
