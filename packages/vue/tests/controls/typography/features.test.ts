import { describe, expect, test } from 'bun:test'

import type { FontFeature } from '@open-pencil/scene-graph'

import {
  featureEnabled,
  fontFeatureSections,
  numberPositionChanges,
  numberPositionOf,
  numberStyleChanges,
  numberStyleOf,
  withFeatures
} from '#vue/controls/typography/features'

const available = (tags: string[]) => tags.map((tag) => ({ tag, name: null }))

describe('font features in the typography panel', () => {
  test('count only the features a font applies by itself as on when unset', () => {
    expect(featureEnabled([], 'LIGA')).toBe(true)
    expect(featureEnabled([], 'TNUM')).toBe(false)
    expect(featureEnabled([{ tag: 'LIGA', enabled: false }], 'LIGA')).toBe(false)
  })

  test('list what the font offers by section, leaving out what it applies by itself', () => {
    const sections = fontFeatureSections([
      ...available(['liga', 'kern', 'ccmp', 'locl', 'case', 'tnum', 'pnum', 'onum', 'frac']),
      ...available(['sups', 'dlig', 'smcp', 'ss02', 'cv11', 'zzzz']),
      { tag: 'ss01', name: 'Open digits' }
    ])
    expect(sections.smallCaps).toBe(true)
    expect(sections.forcedSmallCaps).toBe(false)
    expect(sections.letterCase.map(({ tag }) => tag)).toEqual(['CASE'])
    expect(sections.numberStyles).toEqual([
      'DEFAULT',
      'PNUM_LNUM',
      'TNUM_LNUM',
      'PNUM_ONUM',
      'TNUM_ONUM'
    ])
    expect(sections.numberPositions).toEqual(['NORMAL', 'SUPS'])
    expect(sections.numbers.map(({ tag }) => tag)).toEqual(['FRAC'])
    expect(sections.letterforms.map(({ tag }) => tag)).toEqual(['DLIG'])
    expect(sections.stylisticSets).toEqual([
      { tag: 'SS02', name: null },
      { tag: 'SS01', name: 'Open digits' }
    ])
    expect(sections.characterVariants.map(({ tag }) => tag)).toEqual(['CV11'])
    expect(sections.other.map(({ tag }) => tag)).toEqual(['ZZZZ'])
  })

  test('offer no number styles or positions to a font without them', () => {
    const sections = fontFeatureSections(available(['liga']))
    expect(sections.numberStyles).toEqual([])
    expect(sections.numberPositions).toEqual([])
  })

  test('set a number style by its pair, clearing the other pairs', () => {
    const features = withFeatures(
      [
        { tag: 'ONUM', enabled: true },
        { tag: 'SS01', enabled: true }
      ],
      numberStyleChanges('TNUM_LNUM')
    )
    expect(features).toEqual([
      { tag: 'SS01', enabled: true },
      { tag: 'TNUM', enabled: true },
      { tag: 'LNUM', enabled: true }
    ])
    expect(numberStyleOf(features)).toBe('TNUM_LNUM')
    expect(numberStyleOf(withFeatures(features, numberStyleChanges('DEFAULT')))).toBe('DEFAULT')
  })

  test('put figures in one position at a time', () => {
    let features: FontFeature[] = withFeatures([], numberPositionChanges('SUPS'))
    expect(numberPositionOf(features)).toBe('SUPS')
    features = withFeatures(features, numberPositionChanges('SUBS'))
    expect(features).toEqual([{ tag: 'SUBS', enabled: true }])
    expect(withFeatures(features, numberPositionChanges('NORMAL'))).toEqual([])
  })
})
