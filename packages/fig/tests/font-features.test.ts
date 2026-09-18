import { expect, test } from 'bun:test'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { applyFontFeaturesToKiwi, convertFontFeatures } from '../src/node-change/font/features'

function apply(features: { tag: string; enabled: boolean }[]) {
  const nc: NodeChange = { type: 'TEXT' }
  applyFontFeaturesToKiwi(nc, features)
  return nc
}

test('enabled numeric features set their typed axis', () => {
  expect(apply([{ tag: 'TNUM', enabled: true }]).fontVariantNumericSpacing).toBe('TABULAR')
  expect(apply([{ tag: 'LNUM', enabled: true }]).fontVariantNumericFigure).toBe('LINING')
  expect(apply([{ tag: 'AFRC', enabled: true }]).fontVariantNumericFraction).toBe('STACKED')
  expect(apply([{ tag: 'SMCP', enabled: true }]).fontVariantCaps).toBe('SMALL')
})

test('disabled numeric features clear their axis instead of writing an unknown enum member', () => {
  // The regression: PNUM/TNUM/LNUM/ONUM/FRAC are absent from the schema's OpenTypeFeature
  // enum, so emitting them as raw tags made every affected export throw.
  for (const tag of ['PNUM', 'TNUM', 'LNUM', 'ONUM', 'FRAC', 'AFRC', 'SMCP', 'C2SC']) {
    const nc = apply([{ tag, enabled: false }])
    expect([nc.toggledOnOTFeatures, nc.toggledOffOTFeatures]).toEqual([undefined, undefined])
  }
  expect(apply([{ tag: 'PNUM', enabled: false }]).fontVariantNumericSpacing).toBe('NORMAL')
  expect(apply([{ tag: 'SMCP', enabled: false }]).fontVariantCaps).toBe('NORMAL')
})

test('an enabled tag on an axis wins over a disabled sibling tag', () => {
  // "TNUM on, PNUM off" describes tabular figures; the disabled sibling must not clear it.
  expect(
    apply([
      { tag: 'TNUM', enabled: true },
      { tag: 'PNUM', enabled: false }
    ]).fontVariantNumericSpacing
  ).toBe('TABULAR')
  expect(
    apply([
      { tag: 'PNUM', enabled: false },
      { tag: 'TNUM', enabled: true }
    ]).fontVariantNumericSpacing
  ).toBe('TABULAR')
  expect(
    apply([
      { tag: 'SMCP', enabled: true },
      { tag: 'C2SC', enabled: false }
    ]).fontVariantCaps
  ).toBe('SMALL')
})

test('raw tags survive only when the schema can encode them', () => {
  const known = apply([
    { tag: 'CASE', enabled: true },
    { tag: 'KERN', enabled: false }
  ])
  expect(known.toggledOnOTFeatures).toEqual(['CASE'])
  expect(known.toggledOffOTFeatures).toEqual(['KERN'])

  const unknown = apply([
    { tag: 'ZZZZ', enabled: true },
    { tag: 'YYYY', enabled: false }
  ])
  expect(unknown.toggledOnOTFeatures).toBeUndefined()
  expect(unknown.toggledOffOTFeatures).toBeUndefined()
})

test('boolean features map in both directions', () => {
  expect(apply([{ tag: 'LIGA', enabled: false }]).fontVariantCommonLigatures).toBe(false)
  expect(apply([{ tag: 'LIGA', enabled: true }]).fontVariantCommonLigatures).toBe(true)
})

test('the feature model round-trips through the Kiwi fields', () => {
  const nc = apply([
    { tag: 'TNUM', enabled: true },
    { tag: 'LIGA', enabled: false },
    { tag: 'CASE', enabled: true }
  ])
  expect(convertFontFeatures(nc)).toEqual([
    { tag: 'LIGA', enabled: false },
    { tag: 'TNUM', enabled: true },
    { tag: 'CASE', enabled: true }
  ])
})
