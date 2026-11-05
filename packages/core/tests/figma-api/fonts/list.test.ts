import { afterEach, beforeEach, expect, test } from 'bun:test'

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
