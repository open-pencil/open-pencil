import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { expectDefined } from '#core-tests/helpers/assert'
import { FIXTURES } from '#core-tests/helpers/paths'
import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'

import { buildParagraph } from '#core/canvas/text'
import { withFigExportRuntime } from '#core/canvas/text/shape'
import { getCanvasKit } from '#core/canvaskit'
import { FontManager, fontManager } from '#core/text/font/manager'
import { WEB_FONT_PROVIDER_IDS } from '#core/text/web-font/resolver'
import { glyphOutlineSourceSync } from '#core/text/font/glyphs'

/** A family only these tests load, so faces other tests load cannot answer for it. */
const FAMILY = 'Faces Test Sans'

async function bundled(file: string): Promise<ArrayBuffer> {
  return expectDefined(await new FontManager().fetchBundledFont(file), file)
}

/** The pixels of text in a style, drawn by the paragraph the canvas draws. */
function drawn(
  ck: CanvasKit,
  fontProvider: TypefaceFontProvider,
  style: Partial<SceneNode> & { fontWeight: number; italic: boolean }
): Uint8Array {
  const node = createDefaultNode(() => 'face-text', 'TEXT', {
    text: 'Faces',
    fontFamily: FAMILY,
    fontSize: 40,
    width: 300,
    height: 60,
    ...style
  })
  const paragraph = buildParagraph({ ck, fontProvider, fontsLoaded: true }, node, ck.BLACK, {
    halfLeading: true
  })
  const surface = expectDefined(ck.MakeSurface(300, 60), 'surface')
  try {
    surface.getCanvas().clear(ck.WHITE)
    paragraph.layout(300)
    paragraph.draw(surface.getCanvas(), 0, 0)
    return expectDefined(
      surface.getCanvas().readPixels(0, 0, {
        width: 300,
        height: 60,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'pixels'
    ) as Uint8Array
  } finally {
    surface.delete()
  }
}

function fixtureFont(file: string): Promise<ArrayBuffer> {
  return Bun.file(join(FIXTURES, 'fonts', file)).arrayBuffer()
}

/** How many characters of `text` the paragraph the canvas draws shapes to the missing glyph. */
function missingGlyphs(
  ck: CanvasKit,
  fontProvider: TypefaceFontProvider,
  fontFamily: string,
  text: string
): number {
  const node = createDefaultNode(() => 'face-text', 'TEXT', {
    text,
    fontFamily,
    fontSize: 40,
    width: 600,
    height: 60
  })
  const paragraph = buildParagraph({ ck, fontProvider, fontsLoaded: true }, node, ck.BLACK)
  try {
    paragraph.layout(600)
    return paragraph
      .getShapedLines()
      .flatMap((line) => line.runs.flatMap((run) => Array.from(run.glyphs)))
      .filter((glyph) => glyph === 0).length
  } finally {
    paragraph.delete()
  }
}

/**
 * Asked for a face a family has not loaded, CanvasKit would slant or embolden another, which
 * neither Figma, a browser, nor a native text stack draws the same. Figma draws a missing face as
 * the face that exists and reports it missing; so does the canvas.
 */
describe('text faces', () => {
  test('draws a missing face as the loaded one rather than faking it', async () => {
    const ck = await getCanvasKit()
    const fontProvider = ck.TypefaceFontProvider.Make()
    fontManager.attachProvider(ck, fontProvider)
    // A family of its own, whose Bold and italic no other test loads.
    const fontFamily = 'Faces Test Missing'
    await fontManager.markLoaded(fontFamily, 'Regular', await bundled('/InterVariable.ttf'))
    const face = (weight: number, italic: boolean) =>
      drawn(ck, fontProvider, { fontFamily, fontWeight: weight, italic })
    const regular = face(400, false)
    expect(face(400, true)).toEqual(regular)
    expect(face(700, false)).toEqual(regular)
  })

  test('draws a face the family has loaded', async () => {
    const ck = await getCanvasKit()
    const fontProvider = ck.TypefaceFontProvider.Make()
    fontManager.attachProvider(ck, fontProvider)
    await fontManager.markLoaded(FAMILY, 'Regular', await bundled('/InterVariable.ttf'))
    await fontManager.markLoaded(FAMILY, 'Bold', await bundled('/InterVariable.ttf'))
    const regular = drawn(ck, fontProvider, { fontWeight: 400, italic: false })
    expect(drawn(ck, fontProvider, { fontWeight: 700, italic: false })).not.toEqual(regular)
  })

  test('draws a face named apart from its weight as the named instance of that name', async () => {
    const ck = await getCanvasKit()
    const fontProvider = ck.TypefaceFontProvider.Make()
    fontManager.attachProvider(ck, fontProvider)
    // Inter with an extra instance, "Display Heavy" at wght 850, as Roboto has "Condensed Bold".
    const fontFamily = 'Faces Test Named'
    await fontManager.markLoaded(fontFamily, 'Regular', await fixtureFont('InterVariable-Named.ttf'))
    expect(await fontManager.loadFont(fontFamily, 'Display Heavy')).not.toBeNull()
    // A name the font has no instance of is not drawn by some other instance.
    expect(await fontManager.loadFont(fontFamily, 'Condensed Bold')).toBeNull()
    const face = (fields: Partial<SceneNode>) =>
      drawn(ck, fontProvider, { fontFamily, fontWeight: 400, italic: false, ...fields })
    const named = face({ fontWeight: 850, fontStyle: 'Display Heavy' })
    expect(named).toEqual(face({ fontVariations: [{ axis: 'wght', value: 850 }] }))
    expect(named).not.toEqual(face({}))
    // Its weight alone picks the instance its weight is nearest, Black at 900, not this face.
    expect(named).not.toEqual(face({ fontWeight: 850 }))
  })

  test('draws optical size at the font size unless the text detaches it, as Figma does', async () => {
    const ck = await getCanvasKit()
    const fontProvider = ck.TypefaceFontProvider.Make()
    fontManager.attachProvider(ck, fontProvider)
    // Inter's optical size axis runs from 14 to 32, so text at 40 follows it to 32.
    const variable = await Bun.file(
      join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')
    ).arrayBuffer()
    const fontFamily = 'Faces Test Optical'
    await fontManager.markLoaded(fontFamily, 'Regular', variable)
    const face = (fields: Partial<SceneNode>) =>
      drawn(ck, fontProvider, { fontFamily, fontWeight: 400, italic: false, ...fields })
    const automatic = face({})
    expect(face({ fontVariations: [{ axis: 'opsz', value: 14 }] })).toEqual(automatic)
    expect(
      face({ opticalSizeFromFontSize: false, fontVariations: [{ axis: 'opsz', value: 14 }] })
    ).not.toEqual(automatic)
    expect(
      face({ opticalSizeFromFontSize: false, fontVariations: [{ axis: 'opsz', value: 32 }] })
    ).toEqual(automatic)
    // A range detaches its own optical size, as Figma saves one, over text that follows it.
    const range = (style: Partial<SceneNode['styleRuns'][number]['style']>) =>
      face({ styleRuns: [{ start: 0, length: 5, style }] })
    expect(range({ fontVariations: [{ axis: 'opsz', value: 14 }] })).toEqual(automatic)
    expect(
      range({ opticalSizeFromFontSize: false, fontVariations: [{ axis: 'opsz', value: 14 }] })
    ).toEqual(face({ opticalSizeFromFontSize: false, fontVariations: [{ axis: 'opsz', value: 14 }] }))
  })

  test('draws each style of a family loaded from several files from its own file', async () => {
    const ck = await getCanvasKit()
    const fontProvider = ck.TypefaceFontProvider.Make()
    fontManager.attachProvider(ck, fontProvider)
    // A static Regular and a variable file loaded for Light both declare weight 400, which
    // CanvasKit would tie between.
    const regular = await Bun.file(join(FIXTURES, 'fonts', 'InterRegular-Faces.ttf')).arrayBuffer()
    const variable = await Bun.file(
      join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')
    ).arrayBuffer()
    await fontManager.markLoaded('Faces Test Mixed', 'Regular', regular)
    await fontManager.markLoaded('Faces Test Mixed', 'Light', variable)
    await fontManager.markLoaded('Faces Test Variable Only', 'Light', variable)
    const light = (fontFamily: string) =>
      drawn(ck, fontProvider, { fontFamily, fontWeight: 300, italic: false })
    expect(light('Faces Test Mixed')).toEqual(light('Faces Test Variable Only'))
  })

  test('draws a style from the file that replaced the one it loaded first', async () => {
    // A web font fetched again for more characters replaces the file the style loaded first,
    // which stays registered under the family's name ahead of it.
    const ck = await getCanvasKit()
    const fontProvider = ck.TypefaceFontProvider.Make()
    fontManager.attachProvider(ck, fontProvider)
    const fontFamily = 'Faces Test Replaced'
    await fontManager.markLoaded(fontFamily, 'Regular', await fixtureFont('InterVariable-Latin.ttf'))
    await fontManager.markLoaded(fontFamily, 'Regular', await fixtureFont('NotoSansSC-Regular.ttf'))
    expect(missingGlyphs(ck, fontProvider, fontFamily, '中文')).toBe(0)
  })

  test('draws a web font split by unicode-range from each of its files', async () => {
    // As a CJK family comes: a Latin file, and shards for the rest.
    const ck = await getCanvasKit()
    const fontProvider = ck.TypefaceFontProvider.Make()
    fontManager.attachProvider(ck, fontProvider)
    const fontFamily = 'Faces Test Shards'
    const CJK_SHARD = 'https://fonts.gstatic.com/s/test/shards-cjk.ttf'
    const files = {
      'https://fonts.gstatic.com/s/test/shards-latin.ttf': {
        range: 'U+0000-00FF',
        data: await fixtureFont('InterVariable-Latin.ttf')
      },
      [CJK_SHARD]: {
        range: 'U+4E00-9FFF',
        data: await fixtureFont('NotoSansSC-Regular.ttf')
      }
    }
    const providers = fontManager.enabledOnlineFontProviders()
    fontManager.setOnlineFontProviders({ google: true })
    fontManager.setWebFontFetch(async (url) => {
      if (url.startsWith('https://fonts.google.com/metadata/fonts'))
        return Response.json({ familyMetadataList: [{ family: fontFamily, fonts: { '400': {} }, axes: [] }] })
      if (url.startsWith('https://fonts.google.com/metadata/icons'))
        return new Response(`)]}'\n${JSON.stringify({ families: [] })}`)
      if (url.startsWith('https://fonts.googleapis.com/css2'))
        return new Response(
          Object.entries(files)
            .map(
              ([src, { range }]) =>
                `@font-face { font-family: '${fontFamily}'; font-weight: 400; src: url(${src}) format('truetype'); unicode-range: ${range}; }`
            )
            .join('\n')
        )
      const file = Object.entries(files).find(([src]) => src === url)?.[1]
      return file ? new Response(file.data.slice(0)) : new Response(null, { status: 404 })
    })
    try {
      await fontManager.loadFont(fontFamily, 'Regular', 'Faces 中文')
      expect(missingGlyphs(ck, fontProvider, fontFamily, 'Faces 中文')).toBe(0)
      // And paints them as the CJK file does on its own.
      await fontManager.markLoaded('Faces Test Han', 'Regular', files[CJK_SHARD].data)
      const paint = (family: string, text: string) =>
        drawn(ck, fontProvider, { fontFamily: family, text, fontWeight: 400, italic: false })
      expect(paint(fontFamily, '中文')).toEqual(paint('Faces Test Han', '中文'))
      expect(paint(fontFamily, '中文')).not.toEqual(paint(fontFamily, ' '))
    } finally {
      fontManager.setWebFontFetch(null)
      fontManager.setOnlineFontProviders(
        Object.fromEntries(WEB_FONT_PROVIDER_IDS.map((id) => [id, providers.includes(id)]))
      )
    }
  })

  /**
   * One face for the whole text: a family without the requested face draws its own, and the
   * characters it lacks fall back in that same face, which is the outline saved for them.
   */
  test('saves fallback characters in the face the text is drawn in', async () => {
    const primary = 'Faces Test Naskh'
    await fontManager.markLoaded(primary, 'Regular', await bundled('/NotoNaskhArabic-Regular.ttf'))
    await fontManager.markLoaded('Inter', 'Regular', await bundled('/InterVariable.ttf'))
    await fontManager.markLoaded('Inter', 'Bold', await bundled('/InterVariable.ttf'))
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'F',
      fontFamily: primary,
      fontWeight: 700,
      fontSize: 40,
      width: 200,
      height: 60,
      textAutoResize: 'NONE'
    })
    const shaped = expectDefined(
      await withFigExportRuntime(graph, await getCanvasKit(), async (runtime) =>
        runtime.shapeText(node)
      ),
      'shaped text'
    )
    // At the optical size the font size sets, as the paragraph draws every family it falls back to.
    const regular = expectDefined(
      glyphOutlineSourceSync('Inter', 'Regular', [{ axis: 'opsz', value: 40 }]),
      'Inter Regular'
    )
    expect(shaped.glyphs[0]?.commands).toEqual(regular.outline(regular.glyphOf('F'), 40))
  })
})
