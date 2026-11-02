/**
 * Live Google Fonts checks. They reach the network, so they run only with LAWHA_LIVE_FONTS=1:
 *   LAWHA_LIVE_FONTS=1 bun test packages/core/tests/text/web-font/google-live.test.ts
 */
import { describe, expect, test } from 'bun:test'

import { getCanvasKit } from '#core/canvaskit'
import { WebFontResolver } from '#core/text/web-font/resolver'

const live = process.env.LAWHA_LIVE_FONTS === '1'
const suite = live ? describe : describe.skip

const ARABIC_FAMILIES = [
  'Cairo',
  'Tajawal',
  'Almarai',
  'Amiri',
  'Changa',
  'El Messiri',
  'IBM Plex Sans Arabic',
  'Lalezar',
  'Lateef',
  'Markazi Text',
  'Mada',
  'Noto Kufi Arabic',
  'Noto Naskh Arabic',
  'Noto Sans Arabic',
  'Readex Pro',
  'Reem Kufi',
  'Rubik',
  'Scheherazade New',
  'Harmattan',
  'Baloo Bhaijaan 2',
  'Aref Ruqaa',
  'Kufam',
  'Vazirmatn',
  'Marhey',
  'Alexandria'
]

const SAMPLE = 'أبجد هوز حطي كلمن سعفص قرشت ١٢٣'

/** Render SAMPLE with the downloaded font and report any character that fell to notdef. */
async function missingArabicGlyphs(family: string, buffers: ArrayBuffer[]): Promise<number> {
  const ck = await getCanvasKit()
  const provider = ck.TypefaceFontProvider.Make()
  for (const buffer of buffers) provider.registerFont(buffer, family)
  const style = new ck.ParagraphStyle({
    textStyle: { fontFamilies: [family], fontSize: 24, color: ck.BLACK },
    textDirection: ck.TextDirection.RTL
  })
  const builder = ck.ParagraphBuilder.MakeFromFontProvider(style, provider)
  builder.addText(SAMPLE)
  const paragraph = builder.build()
  paragraph.layout(1000)
  let missing = 0
  for (const line of paragraph.getShapedLines())
    for (const run of line.runs) for (const glyph of run.glyphs) if (glyph === 0) missing++
  paragraph.delete()
  builder.delete()
  provider.delete()
  return missing
}

suite('Google Fonts, live', () => {
  const resolver = new WebFontResolver()
  resolver.setEnabled({ google: true })

  test('lists the full Google Fonts catalog', async () => {
    const families = await resolver.listFamilies('google')
    expect(families.length).toBeGreaterThan(1500)
    for (const family of ARABIC_FAMILIES) expect(families).toContain(family)
  }, 60_000)

  test.each(ARABIC_FAMILIES)(
    '%s downloads on demand and draws every Arabic character',
    async (family) => {
      const font = await resolver.fetchFont([family], 'Regular', SAMPLE)
      expect(font?.provider).toBe('google')
      const buffers = font?.buffers ?? []
      expect(buffers.length).toBeGreaterThan(0)
      expect(await missingArabicGlyphs(family, buffers)).toBe(0)
    },
    60_000
  )

  test('a static family serves a separate bold face', async () => {
    // Cairo is variable (one file for every weight); Amiri ships static Regular and Bold files.
    const regular = await resolver.fetchFont(['Amiri'], 'Regular', SAMPLE)
    const bold = await resolver.fetchFont(['Amiri'], 'Bold', SAMPLE)
    const size = (f: typeof regular) => (f?.buffers ?? []).reduce((n, b) => n + b.byteLength, 0)
    expect(size(regular)).toBeGreaterThan(0)
    expect(size(bold)).toBeGreaterThan(0)
    expect(bold?.buffers[0]).not.toEqual(regular?.buffers[0])
  }, 60_000)

  test('lists the faces Cairo actually offers', async () => {
    const faces = await resolver.familyFaces('Cairo')
    expect(faces.length).toBeGreaterThanOrEqual(5)
  }, 60_000)
})
