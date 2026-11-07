import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { facesFromStyles, fontManager, type WebFontProviderId } from '@open-pencil/core/text'
import { SceneGraph } from '@open-pencil/scene-graph'

let providers: WebFontProviderId[] = []

// No web provider is asked, so the listed families are the bundled and installed ones.
beforeEach(() => {
  providers = fontManager.enabledOnlineFontProviders()
  fontManager.setOnlineFontProviders({})
})

afterEach(() => {
  fontManager.setHostFontCatalog([])
  fontManager.setOnlineFontProviders(
    Object.fromEntries(providers.map((provider) => [provider, true]))
  )
})

async function stylesOf(family: string): Promise<string[]> {
  const fonts = await new FigmaAPI(new SceneGraph()).listAvailableFontsAsync()
  return fonts.filter(({ fontName }) => fontName.family === family).map(({ fontName }) => fontName.style)
}

test('figma.listAvailableFontsAsync lists every face of a bundled family', async () => {
  const styles = await stylesOf('Inter')
  expect(styles).toContain('Regular')
  expect(styles).toContain('Bold')
  expect(styles).toContain('Bold Italic')
})

test('figma.listAvailableFontsAsync lists an installed family with the names of its faces', async () => {
  fontManager.setHostFontCatalog([
    { family: 'List Installed', faces: facesFromStyles(['Book', 'Heavy Oblique']) }
  ])
  expect(await stylesOf('List Installed')).toEqual(['Book', 'Heavy Oblique'])
})

test('figma.listAvailableFontsAsync keeps the faces of a web family whose font did not load', async () => {
  const family = 'List Looked Up'
  fontManager.setOnlineFontProviders({ google: true })
  fontManager.setWebFontFetch(async (url) => {
    if (url.startsWith('https://fonts.google.com/metadata/fonts'))
      return Response.json({
        familyMetadataList: [{ family, fonts: { '400': {}, '700': {} }, axes: [] }]
      })
    if (url.startsWith('https://fonts.google.com/metadata/icons'))
      return new Response(`)]}'\n${JSON.stringify({ families: [] })}`)
    if (url.startsWith('https://fonts.googleapis.com/css2'))
      return new Response(
        [400, 700]
          .map(
            (weight) =>
              `@font-face { font-family: '${family}'; font-style: normal; font-weight: ${weight}; src: url(https://fonts.gstatic.com/s/test/missing-${weight}.ttf) format('truetype'); }`
          )
          .join('\n')
      )
    return new Response(null, { status: 404 })
  })
  // A browser's first listing asks for its local fonts, which forgets the faces found so far.
  const listFamilyOptions = fontManager.listFamilyOptions.bind(fontManager)
  const listing = spyOn(fontManager, 'listFamilyOptions').mockImplementation(async () => {
    await fontManager.requestLocalFontAccess()
    return listFamilyOptions()
  })
  try {
    const figma = new FigmaAPI(new SceneGraph())
    // The faces are looked up, but the font itself cannot be downloaded.
    await expect(figma.loadFontAsync({ family, style: 'Bold' })).rejects.toThrow()
    expect(fontManager.isLoaded(family)).toBe(false)
    expect(fontManager.loadedFamilyFaces(family)?.map(({ style }) => style)).toEqual([
      'Regular',
      'Bold'
    ])
    expect(await stylesOf(family)).toEqual(['Regular', 'Bold'])
  } finally {
    listing.mockRestore()
    fontManager.setWebFontFetch(null)
  }
})
