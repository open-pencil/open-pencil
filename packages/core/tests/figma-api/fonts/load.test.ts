import { beforeAll, expect, test } from 'bun:test'
import { join } from 'node:path'

import { asTextNode, registerTestFont } from '#core-tests/helpers/figma-api'
import { FIXTURES } from '#core-tests/helpers/paths'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { fontManager } from '@open-pencil/core/text'
import { SceneGraph } from '@open-pencil/scene-graph'

beforeAll(() => registerTestFont('Load Test'))

test('figma.loadFontAsync loads a style however a script spells it', async () => {
  const figma = new FigmaAPI(new SceneGraph())
  await figma.loadFontAsync({ family: 'Load Test', style: 'Semi Bold' })
  await figma.loadFontAsync({ family: 'Load Test', style: 'Italic' })
  expect(fontManager.isStyleLoaded('Load Test', 'SemiBold')).toBe(true)
  expect(fontManager.isStyleLoaded('Load Test', 'Regular Italic')).toBe(true)
})

test('figma.loadFontAsync loads every named style of a family named alone', async () => {
  await new FigmaAPI(new SceneGraph()).loadFontAsync({ family: 'Load Test' })
  expect(fontManager.isStyleLoaded('Load Test', 'Black')).toBe(true)
  expect(fontManager.isStyleLoaded('Load Test', 'Thin Italic')).toBe(true)
})

test('figma.loadFontAsync rejects a font that cannot load, as Figma does', async () => {
  const figma = new FigmaAPI(new SceneGraph())
  await expect(figma.loadFontAsync({ family: 'Missing', style: 'Regular' })).rejects.toThrow(
    'The font "Missing Regular" could not be loaded'
  )
  await expect(figma.loadFontAsync({ family: 'Missing' })).rejects.toThrow(
    'The font "Missing Regular" could not be loaded'
  )
})

test('figma.loadFontAsync rejects a style the family has no face of, as Figma does', async () => {
  const figma = new FigmaAPI(new SceneGraph())
  // Bundled Inter lists its faces; a name none of them has is not some other face of it.
  await expect(figma.loadFontAsync({ family: 'Inter', style: 'Condensed Bold' })).rejects.toThrow(
    'The font "Inter Condensed Bold" could not be loaded'
  )
  await expect(figma.loadFontAsync({ family: 'Inter', style: 'Bogus' })).rejects.toThrow(
    'The font "Inter Bogus" could not be loaded'
  )
})

test('figma.loadFontAsync loads a named instance by its name, at its weight', async () => {
  const family = 'Load Named'
  const data = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Named.ttf')).arrayBuffer()
  await fontManager.markLoaded(family, 'Regular', data)
  const figma = new FigmaAPI(new SceneGraph())
  await figma.loadFontAsync({ family, style: 'Display Heavy' })
  expect(fontManager.isStyleLoaded(family, 'Display Heavy')).toBe(true)
  const text = asTextNode(figma.createText())
  text.fontName = { family, style: 'Display Heavy' }
  expect(text.fontName).toMatchObject({ family, style: 'Display Heavy' })
  expect(text.fontWeight).toBe(850)
})

test('figma.loadFontAsync loads an installed face by the name its font gives it', async () => {
  const family = 'Load Installed'
  const book = await Bun.file(join(FIXTURES, 'fonts', 'InterRegular-Faces.ttf')).arrayBuffer()
  fontManager.setHostFontCatalog([
    {
      family,
      faces: [
        { style: 'Book', weight: 350, italic: false },
        { style: 'Roman', weight: 400, italic: false }
      ]
    }
  ])
  fontManager.setHostFontLoader(async (requested, style) =>
    requested === family && style === 'Book' ? book.slice(0) : null
  )
  try {
    const figma = new FigmaAPI(new SceneGraph())
    await figma.loadFontAsync({ family, style: 'Book' })
    expect(fontManager.isStyleLoaded(family, 'Book')).toBe(true)
    const text = asTextNode(figma.createText())
    text.fontName = { family, style: 'Book' }
    expect(text.fontWeight).toBe(350)
    // Roman, its other face of about that weight, is a face of its own the host did not give.
    await expect(figma.loadFontAsync({ family, style: 'Roman' })).rejects.toThrow(
      `The font "${family} Roman" could not be loaded`
    )
  } finally {
    fontManager.setHostFontLoader(null)
    fontManager.setHostFontCatalog([])
  }
})
