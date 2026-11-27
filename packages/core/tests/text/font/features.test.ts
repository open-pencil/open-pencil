import { beforeAll, expect, test } from 'bun:test'

import { fontFeaturesSync, fontManager } from '#core/text/index'

beforeAll(async () => {
  await fontManager.loadFont('Inter', 'Regular')
})

test("lists a loaded font's features once each, with its names for sets and variants", () => {
  const features = fontFeaturesSync('Inter', 'Regular')
  const tags = features?.map((feature) => feature.tag) ?? []
  expect(tags).toEqual(expect.arrayContaining(['calt', 'tnum', 'case', 'ss01', 'cv01']))
  expect(new Set(tags).size).toBe(tags.length)
  expect(features?.find((feature) => feature.tag === 'ss01')?.name).toBe('Open digits')
  expect(features?.find((feature) => feature.tag === 'tnum')?.name).toBeNull()
})

test('knows nothing of a font that is not loaded', () => {
  expect(fontFeaturesSync('Nowhere Sans', 'Regular')).toBeNull()
})
