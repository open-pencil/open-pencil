import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import type { CanvasKit, Paragraph, ParagraphBuilder, TypefaceFontProvider } from 'canvaskit-wasm'

import { initCanvasKit } from '#cli/headless'
import { LabelParagraphCache } from '#core/canvas/labels/paragraph-cache'

import { expectDefined } from '#tests/helpers/assert'
import { repoPath } from '#tests/helpers/paths'

let ck: Awaited<ReturnType<typeof initCanvasKit>>
let provider: TypefaceFontProvider
beforeAll(async () => {
  ck = await initCanvasKit()
  provider = ck.TypefaceFontProvider.Make()
  provider.registerFont(readFileSync(repoPath('public/Inter-Regular.ttf')), 'Inter')
  provider.registerFont(readFileSync(repoPath('public/Inter-SemiBold.ttf')), 'Inter')
})
afterAll(() => provider.delete())

function withLabel<T>(
  cache: LabelParagraphCache,
  text: string,
  width: number,
  consume: (paragraph: Paragraph) => T
): T {
  return cache.use(ck, provider, text, 11, width, ck.BLACK, 1, ({ paragraph }) =>
    consume(paragraph)
  )
}

describe('label paragraph reuse', () => {
  test('reuses fitting widths without re-layout and keeps ellipsis variants separate', () => {
    const cache = new LabelParagraphCache()
    try {
      withLabel(cache, 'Button', 300, (first) => {
        for (const width of [200, 100, 180, 301]) {
          withLabel(cache, 'Button', width, (next) => expect(next).toBe(first))
        }
        withLabel(cache, 'Button', 5, (clipped) => {
          expect(clipped).not.toBe(first)
          expect(clipped.didExceedMaxLines()).toBe(true)
        })
        withLabel(cache, 'Button', 100, (next) => expect(next).toBe(first))
      })
      expect(cache.size()).toBe(2)
    } finally {
      cache.clear()
    }
  })

  test('pins borrowed native paragraphs across nested eviction, clear and exceptions', () => {
    const cache = new LabelParagraphCache(1)
    let borrowed: Paragraph | undefined
    try {
      expect(() =>
        withLabel(cache, 'First', 200, (first) => {
          borrowed = first
          withLabel(cache, 'Second', 200, (second) => {
            cache.clear()
            expect(first.isDeleted()).toBe(false)
            expect(second.isDeleted()).toBe(false)
          })
          expect(first.isDeleted()).toBe(false)
          throw new Error('consumer failed')
        })
      ).toThrow('consumer failed')
      expect(borrowed?.isDeleted()).toBe(true)
      expect(cache.size()).toBe(0)
    } finally {
      cache.clear()
    }
  })

  test('bounds text units and disposes oversized paragraphs after consumption', () => {
    const cache = new LabelParagraphCache(8, 10)
    let transient: Paragraph | undefined
    try {
      withLabel(cache, 'First', 200, (paragraph) => expect(paragraph.isDeleted()).toBe(false))
      withLabel(cache, 'Second', 200, (paragraph) => expect(paragraph.isDeleted()).toBe(false))
      expect(cache.textUnits()).toBe(6)
      withLabel(cache, 'Oversized label', 200, (paragraph) => {
        transient = paragraph
        expect(paragraph.isDeleted()).toBe(false)
        expect(cache.textUnits()).toBe(6)
      })
      expect(transient?.isDeleted()).toBe(true)
      expect(cache.size()).toBe(1)
    } finally {
      cache.clear()
    }
  })

  test('invalidates on provider identity even when generation is unchanged', () => {
    const other = ck.TypefaceFontProvider.Make()
    const cache = new LabelParagraphCache()
    try {
      withLabel(cache, 'Provider', 200, (first) => {
        cache.use(ck, other, 'Provider', 11, 200, ck.BLACK, 1, ({ paragraph }) => {
          expect(paragraph).not.toBe(first)
          expect(first.isDeleted()).toBe(false)
        })
      })
      expect(cache.size()).toBe(1)
    } finally {
      cache.clear()
      other.delete()
    }
  })

  test.each(['addText', 'layout'])('releases native resources when %s throws', (stage) => {
    const cache = new LabelParagraphCache()
    let builder: ParagraphBuilder | undefined
    let paragraph: Paragraph | undefined
    const fail = () => {
      throw new Error('native failure')
    }
    const kit: CanvasKit = {
      ...ck,
      ParagraphBuilder: {
        ...ck.ParagraphBuilder,
        MakeFromFontProvider: (...args) => {
          const created = ck.ParagraphBuilder.MakeFromFontProvider(...args)
          builder = created
          if (stage === 'addText') created.addText = fail
          else {
            const build = created.build.bind(created)
            created.build = () => {
              const result = build()
              paragraph = result
              result.layout = fail
              return result
            }
          }
          return created
        }
      }
    }
    try {
      expect(() => cache.measure(kit, provider, 'Failure', 11, 200, ck.BLACK, 1)).toThrow(
        'native failure'
      )
      expect(builder?.isDeleted()).toBe(true)
      if (stage === 'layout') expect(paragraph?.isDeleted()).toBe(true)
      expect(cache.size()).toBe(0)
    } finally {
      cache.clear()
      if (builder && !builder.isDeleted()) builder.delete()
      if (paragraph && !paragraph.isDeleted()) paragraph.delete()
    }
  })

  test.each([400, 600])(
    'matches fresh layouts at Unicode/wrap boundaries (weight %i)',
    (fontWeight) => {
      const cached = new LabelParagraphCache()
      const fresh = new LabelParagraphCache(0)
      const surface = expectDefined(ck.MakeSurface(1024, 40), 'label comparison surface')
      const canvas = surface.getCanvas()
      const paint = (cache: LabelParagraphCache, text: string, width: number) => {
        canvas.clear(ck.WHITE)
        const metrics = cache.use(
          ck,
          provider,
          text,
          11,
          width,
          ck.BLACK,
          1,
          ({ paragraph, metrics }) => {
            canvas.drawParagraph(paragraph, 2, 2)
            return metrics
          },
          fontWeight
        )
        surface.flush()
        const image = surface.makeImageSnapshot()
        try {
          return {
            metrics,
            pixels: expectDefined(
              image.readPixels(0, 0, {
                width: 1024,
                height: 40,
                colorType: ck.ColorType.RGBA_8888,
                alphaType: ck.AlphaType.Unpremul,
                colorSpace: ck.ColorSpace.SRGB
              }),
              'label pixels'
            )
          }
        } finally {
          image.delete()
        }
      }
      try {
        for (const text of [
          'Button',
          'AV To ffi',
          '漢字',
          'مرحبا بالعالم',
          'אבג 123',
          '👩🏽‍💻 🇯🇵',
          'é',
          'Trail   ',
          '  Lead',
          'a\tb',
          'one\ntwo',
          'one\r\ntwo',
          'a\u2028b',
          'a\u2029b',
          'a\u0085b',
          '\u202Babc\u202C',
          '\u200Fabc',
          'zero\u200Bwidth',
          '',
          '   '
        ]) {
          const intrinsic = fresh.use(
            ck,
            provider,
            text,
            11,
            1000,
            ck.BLACK,
            1,
            ({ paragraph }) => paragraph.getMaxIntrinsicWidth(),
            fontWeight
          )
          for (const width of [
            1000,
            intrinsic + 1,
            intrinsic + 1 / 64,
            intrinsic,
            intrinsic - 1 / 64,
            intrinsic - 1,
            1,
            0,
            -1,
            120,
            300
          ]) {
            const actual = paint(cached, text, width)
            const expected = paint(fresh, text, width)
            expect(actual.metrics, `${JSON.stringify(text)} at ${width}`).toEqual(expected.metrics)
            expect(actual.pixels, `${JSON.stringify(text)} at ${width}`).toEqual(expected.pixels)
          }
        }
      } finally {
        cached.clear()
        fresh.clear()
        surface.delete()
      }
    }
  )
})
