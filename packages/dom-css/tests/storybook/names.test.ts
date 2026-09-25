import { describe, expect, it } from 'bun:test'

import { claimName, identifierName, storyId } from '#dom-css/storybook/names'
import { sanitize } from 'storybook/internal/csf'

describe('storyId', () => {
  it('matches the installed Storybook', () => {
    for (const title of [
      'Library/Card',
      'library/card',
      'Library/Card 2',
      'Lib `x` "q"/Button\'s "set"',
      'Größe/Knopf',
      'A§B',
      'A-B',
      'Emoji 🙂/Face',
      '—/?'
    ])
      expect(storyId(title)).toBe(sanitize(title))
  })
})

describe('identifierName', () => {
  it('builds PascalCase identifiers from layer and variant names', () => {
    expect(identifierName('Size=Small, Kind=a"b', 'Variant')).toBe('SizeSmallKindAB')
    expect(identifierName('Größe', 'Variant')).toBe('Größe')
    expect(identifierName('Kind=🙂 smile', 'Variant')).toBe('KindSmile')
    expect(identifierName('2xl', 'Variant')).toBe('Variant2Xl')
    expect(identifierName('🙂', 'Variant')).toBe('Variant')
  })
})

describe('claimName', () => {
  it('numbers names that are already taken under the given key', () => {
    const taken = new Set<string>()
    const key = (name: string) => name.toLowerCase()
    expect(['Card', 'card', 'CARD'].map((name) => claimName(name, taken, { key }))).toEqual([
      'Card',
      'card2',
      'CARD3'
    ])
    expect(claimName('Chip', new Set(['Chip']), { separator: ' ' })).toBe('Chip 2')
  })
})
