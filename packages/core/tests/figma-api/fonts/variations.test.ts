import { beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { FIXTURES } from '#core-tests/helpers/paths'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { fontManager } from '@open-pencil/core/text'
import { SceneGraph } from '@open-pencil/scene-graph'

// Behaviour measured in live Figma (2026-10-25) with its variable Inter and Roboto Flex. These
// tests draw from our bundled Inter, whose axes are `opsz` and `wght`, with nine named instances
// from Thin to Black.
const VARIABLE = 'Variations Test'
const STATIC = 'Variations Static'

beforeAll(async () => {
  const variable = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
  const static_ = await Bun.file(join(FIXTURES, 'fonts', 'InterRegular-Faces.ttf')).arrayBuffer()
  await fontManager.markLoaded(VARIABLE, 'Regular', variable)
  await fontManager.markLoaded(VARIABLE, 'Regular Italic', variable)
  await fontManager.markLoaded(STATIC, 'Regular', static_)
  // Text edits need their fonts loaded, as in Figma: the family alone loads its named styles.
  await new FigmaAPI(new SceneGraph()).loadFontAsync({ family: VARIABLE })
})

function text(family = VARIABLE) {
  const api = new FigmaAPI(new SceneGraph())
  const node = api.createText()
  node.fontName = { family, style: 'Regular' }
  node.characters = 'Hamburg'
  return { api, node }
}

describe('variable fonts in the plugin API', () => {
  test('lists a family’s axis tags in code unit order, null for a static family', () => {
    const { api } = text()
    expect(api.getFontFamilyVariationAxes(VARIABLE)).toEqual(['opsz', 'wght'])
    expect(api.getFontFamilyVariationAxes(STATIC)).toBeNull()
    expect(() => api.getFontFamilyVariationAxes('Variations Unloaded')).toThrow(
      'in getFontFamilyVariationAxes: Font family "Variations Unloaded" is not available.'
    )
  })

  test('reads every axis of a variable font, and none of a static one', () => {
    expect(text().node.fontName).toEqual({
      family: VARIABLE,
      style: 'Regular',
      variationSettings: { opsz: 14, wght: 400 }
    })
    expect(text(STATIC).node.fontName).toEqual({ family: STATIC, style: 'Regular' })
  })

  test('picks the nearest named style for axes without a style, the heavier where two tie', () => {
    const { node } = text()
    // Named as the font names its instances: Inter 4 joins "SemiBold".
    for (const [wght, style] of [
      [900, 'Black'],
      [650, 'Bold'],
      [550, 'SemiBold'],
      [450, 'Medium'],
      [1, 'Thin']
    ] as const) {
      node.setRangeFontName(0, node.characters.length, {
        family: VARIABLE,
        variationSettings: { wght }
      })
      expect(node.fontName).toMatchObject({ style, variationSettings: { wght } })
      expect(node.fontWeight).toBe(wght)
    }
  })

  test('keeps a named style under the axes set over it, and the current style with no axes', () => {
    const { node } = text()
    node.fontName = { family: VARIABLE, style: 'Regular', variationSettings: { wght: 550 } }
    expect(node.fontName).toEqual({
      family: VARIABLE,
      style: 'Regular',
      variationSettings: { opsz: 14, wght: 550 }
    })
    expect(node.fontWeight).toBe(550)
    node.fontName = { family: VARIABLE, style: 'Bold' }
    node.setRangeFontName(0, node.characters.length, { family: VARIABLE })
    expect(node.fontName).toMatchObject({ style: 'Bold', variationSettings: { wght: 700 } })
  })

  test('keeps the axes and the slant the text set when axes alone change', () => {
    const { node } = text()
    node.fontName = { family: VARIABLE, style: 'Italic' }
    node.setRangeFontName(0, 7, { family: VARIABLE, variationSettings: { wght: 650 } })
    node.setRangeFontName(0, 7, { family: VARIABLE, variationSettings: { opsz: 20 } })
    // The optical size still follows the font size, so only the weight shows it was kept.
    expect(node.fontName).toMatchObject({
      style: 'Bold Italic',
      variationSettings: { opsz: 14, wght: 650 }
    })
    node.fontName = { family: VARIABLE, style: 'Regular' }
    expect(node.fontName).toMatchObject({ variationSettings: { opsz: 14, wght: 400 } })
  })

  test('reads the axes of the face in the text’s slant', async () => {
    const data = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
    const upright = data.slice(0)
    const italic = data.slice(0)
    await fontManager.markLoaded('Variations Slant', 'Regular', upright)
    await fontManager.markLoaded('Variations Slant', 'Italic', italic)
    expect(fontManager.familyVariation('Variations Slant', true)?.data).toBe(italic)
    expect(fontManager.familyVariation('Variations Slant', false)?.data).toBe(upright)
  })

  test('rejects axes the family does not have, as Figma does, and axes of a family not loaded', () => {
    const { node } = text()
    expect(() => {
      node.fontName = { family: VARIABLE, style: 'Regular', variationSettings: { slnt: -10 } }
    }).toThrow(
      'in set_fontName: "slnt" is not a valid variation setting. Valid settings are ["opsz","wght"].'
    )
    expect(() => {
      node.fontName = { family: STATIC, style: 'Regular', variationSettings: { wght: 700 } }
    }).toThrow(
      `in set_fontName: "wght" is not a valid variation setting. Font "${STATIC}" has no variation axes.`
    )
    expect(() => {
      node.fontName = {
        family: 'Variations Unloaded',
        style: 'Regular',
        variationSettings: { wght: 700 }
      }
    }).toThrow('in set_fontName: Font family "Variations Unloaded" is not loaded')
  })

  test('reads an optical size that follows the font size as the style’s own', () => {
    const { node } = text()
    node.fontSize = 48
    expect(node.fontName).toMatchObject({ variationSettings: { opsz: 14 } })
  })

  test('sets a range’s font from axes alone', () => {
    const { node } = text()
    node.setRangeFontName(0, 3, { family: VARIABLE, variationSettings: { wght: 700 } })
    expect(node.getRangeFontName(0, 3)).toEqual({
      family: VARIABLE,
      style: 'Bold',
      variationSettings: { opsz: 14, wght: 700 }
    })
    expect(node.getRangeFontName(3, 7)).toMatchObject({ style: 'Regular' })
  })

  test('loads every style of a family named alone, one of each slant before the rest', async () => {
    const loaded: string[] = []
    const events: string[] = []
    // Only the host knows the family, so no web provider is asked for its faces.
    const providers = fontManager.enabledOnlineFontProviders()
    fontManager.setOnlineFontProviders({})
    fontManager.setHostFontCatalog([
      { family: 'Variations Load', styles: ['Regular', 'Bold', 'Regular Italic', 'Bold Italic'] }
    ])
    const data = await Bun.file(join(FIXTURES, 'fonts', 'InterRegular-Faces.ttf')).arrayBuffer()
    fontManager.setHostFontLoader(async (family, style) => {
      if (family !== 'Variations Load') return null
      loaded.push(style)
      events.push(`start ${style}`)
      await Promise.resolve()
      events.push(`end ${style}`)
      return data.slice(0)
    })
    try {
      await new FigmaAPI(new SceneGraph()).loadFontAsync({ family: 'Variations Load' })
    } finally {
      fontManager.setHostFontLoader(null)
      fontManager.setHostFontCatalog([])
      fontManager.setOnlineFontProviders(
        Object.fromEntries(providers.map((provider) => [provider, true]))
      )
    }
    expect(loaded.sort()).toEqual(['Bold', 'Bold Italic', 'Regular', 'Regular Italic'])
    for (const style of ['Regular', 'Bold', 'Regular Italic', 'Bold Italic'])
      expect(fontManager.loadedData('Variations Load', style)).not.toBeNull()
    // A variable file the first style of a slant loads is there for the others to reuse.
    const firstDone = Math.max(events.indexOf('end Regular'), events.indexOf('end Regular Italic'))
    const restStart = Math.min(events.indexOf('start Bold'), events.indexOf('start Bold Italic'))
    expect(firstDone).toBeLessThan(restStart)
  })
})
