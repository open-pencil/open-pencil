import { beforeAll, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import { initCanvasKit } from '#cli/headless'
import { LabelParagraphCache } from '#core/canvas/labels/paragraph-cache'
import { resolveLabelFontCoverage } from '#core/canvas/renderer/fonts'
import { resolveParagraphFontFamilies } from '#core/canvas/text/font-families'
import { FontResolver, missingGlyphOccurrences } from '#core/text/resolver'

import { expectDefined } from '#tests/helpers/assert'
import { repoPath } from '#tests/helpers/paths'

let ck: Awaited<ReturnType<typeof initCanvasKit>>
beforeAll(async () => {
  ck = await initCanvasKit()
})

test.each([
  {
    text: 'مرحبا بالعالم',
    family: 'Noto Naskh Arabic',
    path: 'tests/fixtures/fonts/NotoNaskhArabic-Regular.ttf',
    arabic: true
  },
  {
    text: '你好世界',
    family: 'Noto Sans SC',
    path: 'tests/fixtures/fonts/NotoSansSC-Regular.ttf',
    arabic: false
  }
])('labels reuse shared fallback loading and render real $family glyphs', async (fixture) => {
  const provider = ck.TypefaceFontProvider.Make()
  provider.registerFont(readFileSync(repoPath('public/Inter-Regular.ttf')), 'Inter')
  const release = Promise.withResolvers<undefined>()
  const settled = Promise.withResolvers<undefined>()
  let generation = 1
  let loads = 0
  let loaded = false
  const resolver = new FontResolver(async () => {
    loads++
    await release.promise
    provider.registerFont(readFileSync(repoPath(fixture.path)), fixture.family)
    loaded = true
    return true
  })
  const owner = {
    isDestroyed: () => false,
    onFontResolutionSettled: () => {
      generation++
      settled.resolve(undefined)
    }
  }
  const families = () =>
    resolveParagraphFontFamilies(
      'Inter',
      'Regular',
      loaded && fixture.arabic ? [fixture.family] : [],
      loaded && !fixture.arabic ? [fixture.family] : []
    )
  const fresh = new LabelParagraphCache(0, undefined, { families })
  const cache = new LabelParagraphCache(undefined, undefined, {
    families,
    onMissingGlyphs: (missing) => resolveLabelFontCoverage(owner, missing, resolver)
  })
  const surface = expectDefined(ck.MakeSurface(320, 64), 'label font surface')
  try {
    cache.use(ck, provider, fixture.text, 24, 300, ck.BLACK, generation, ({ paragraph }) => {
      expect(
        missingGlyphOccurrences(fixture.text, paragraph.getShapedLines()).length
      ).toBeGreaterThan(0)
    })
    cache.measure(ck, provider, fixture.text, 24, 300, ck.BLACK, generation)
    expect(loads).toBe(1)
    release.resolve(undefined)
    await settled.promise
    const canvas = surface.getCanvas()
    canvas.clear(ck.WHITE)
    cache.use(ck, provider, fixture.text, 24, 300, ck.BLACK, generation, ({ paragraph }) => {
      expect(missingGlyphOccurrences(fixture.text, paragraph.getShapedLines())).toEqual([])
      canvas.drawParagraph(paragraph, 2, 2)
    })
    surface.flush()
    const image = surface.makeImageSnapshot()
    try {
      const pixels = expectDefined(
        image.readPixels(0, 0, {
          width: 320,
          height: 64,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Unpremul,
          colorSpace: ck.ColorSpace.SRGB
        }),
        'label font pixels'
      )
      let ink = 0
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 128 && pixels[i + 3] > 0) ink++
      expect(ink).toBeGreaterThan(40)
    } finally {
      image.delete()
    }
    const intrinsic = cache.measure(ck, provider, fixture.text, 24, 300, ck.BLACK, generation).width
    const shape = (candidate: LabelParagraphCache, width: number, weight: number) =>
      candidate.use(
        ck,
        provider,
        fixture.text,
        24,
        width,
        ck.BLACK,
        generation,
        ({ paragraph, metrics }) => ({
          metrics,
          runs: paragraph.getShapedLines().map((line) =>
            line.runs.map((run) => ({
              glyphs: [...run.glyphs],
              positions: [...run.positions],
              offsets: [...run.offsets]
            }))
          )
        }),
        weight
      )
    for (const weight of [400, 600]) {
      for (const width of [
        300,
        intrinsic - 1,
        intrinsic,
        intrinsic + 0.01,
        intrinsic + 0.25,
        intrinsic + 0.75,
        intrinsic + 1,
        intrinsic + 2,
        300
      ]) {
        expect(shape(cache, width, weight)).toEqual(shape(fresh, width, weight))
      }
    }
    expect(loads).toBe(1)
  } finally {
    release.resolve(undefined)
    if (loads > 0) await settled.promise
    cache.clear()
    fresh.clear()
    surface.delete()
    provider.delete()
  }
})
