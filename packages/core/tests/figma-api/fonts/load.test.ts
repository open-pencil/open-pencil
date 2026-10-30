import { beforeAll, expect, test } from 'bun:test'

import { registerTestFont } from '#core-tests/helpers/figma-api'

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
