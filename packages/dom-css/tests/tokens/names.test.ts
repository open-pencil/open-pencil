import { describe, expect, test } from 'bun:test'

import {
  deriveCSSName,
  parseCSSName,
  tokenSlug,
  tokenNumberToCSS,
  variableCSSNames,
  variableUnit
} from '@open-pencil/dom-css/export'
import type { Variable } from '@open-pencil/scene-graph'

function token(name: string, overrides: Partial<Variable> = {}): Variable {
  return {
    id: name,
    name,
    type: 'FLOAT',
    collectionId: 'c',
    valuesByMode: { m: 8 },
    description: '',
    hiddenFromPublishing: false,
    ...overrides
  }
}

describe('token CSS names', () => {
  test('derive a Tailwind namespace from type, scopes, or the leading segment', () => {
    expect(deriveCSSName(token('Gray/50', { type: 'COLOR' }))).toBe('color-gray-50')
    expect(deriveCSSName(token('Colors/Brand primary', { type: 'COLOR' }))).toBe(
      'color-brand-primary'
    )
    expect(deriveCSSName(token('Card', { scopes: ['CORNER_RADIUS'] }))).toBe('radius-card')
    expect(deriveCSSName(token('Space/small'))).toBe('spacing-small')
    expect(deriveCSSName(token('Heading', { scopes: ['FONT_SIZE'] }))).toBe('text-heading')
    expect(deriveCSSName(token('Bold', { scopes: ['FONT_STYLE'] }))).toBe('font-weight-bold')
    expect(deriveCSSName(token('Brand', { type: 'STRING', scopes: ['FONT_FAMILY'] }))).toBe(
      'font-brand'
    )
  })

  test('leave a token outside every namespace unprefixed', () => {
    expect(deriveCSSName(token('Elevation/1'))).toBe('elevation-1')
    expect(deriveCSSName(token('Fade', { scopes: ['OPACITY'] }))).toBe('fade')
    expect(deriveCSSName(token('Mixed', { scopes: ['GAP', 'CORNER_RADIUS'] }))).toBe('mixed')
  })

  test('keep letters outside ASCII, which custom properties allow, and fall back for none', () => {
    expect(deriveCSSName(token('Цвет/фон', { type: 'COLOR' }))).toBe('color-цвет-фон')
    expect(deriveCSSName(token('🎨', { type: 'COLOR' }))).toBe('color-token')
  })

  test('keep digits on their word, as Tailwind keys do', () => {
    expect(deriveCSSName(token('Text/2xl', { scopes: ['FONT_SIZE'] }))).toBe('text-2xl')
    expect(deriveCSSName(token('Heading/H1', { scopes: ['FONT_SIZE'] }))).toBe('text-heading-h1')
    expect(deriveCSSName(token('brandPrimary', { type: 'COLOR' }))).toBe('color-brand-primary')
    expect(tokenSlug('M3')).toBe('m3')
  })

  test('say a group once when the next segment repeats it, as Tailwind-class names do', () => {
    expect(deriveCSSName(token('Gap/gap-1'))).toBe('gap-1')
    expect(deriveCSSName(token('Gap/gap-1', { scopes: ['GAP'] }))).toBe('spacing-gap-1')
    expect(deriveCSSName(token('Blue/Blue', { type: 'COLOR' }))).toBe('color-blue')
    expect(deriveCSSName(token('Gap/gapless'))).toBe('gap-gapless')
  })

  test('read custom property names from code snippets only', () => {
    expect(parseCSSName('var(--color-primary)')).toBe('color-primary')
    expect(parseCSSName('var(--ui-bg, #fff)')).toBe('ui-bg')
    expect(parseCSSName('--ui-primary')).toBe('ui-primary')
    expect(parseCSSName('rounded-xs')).toBeUndefined()
    expect(parseCSSName('theme.colors.primary')).toBeUndefined()
    expect(parseCSSName('var(--a) var(--b)')).toBeUndefined()
  })

  test('give the first claimant of a WEB name that name and derive the rest', () => {
    const names = variableCSSNames([
      token('Info', { type: 'COLOR', codeSyntax: { WEB: '--ui-info' } }),
      token('Success', { type: 'COLOR', codeSyntax: { WEB: 'var(--ui-info)' } }),
      token('Colors/Info', { type: 'COLOR', codeSyntax: { WEB: 'text-info' } }),
      token('Info ', { type: 'COLOR' })
    ])
    expect([...names.values()]).toEqual(['ui-info', 'color-success', 'color-info', 'color-info-2'])
  })
})

describe('token units', () => {
  test('infer pixels for lengths and no unit for opacity and weights', () => {
    expect(variableUnit(token('Space/small'))).toBe('px')
    expect(variableUnit(token('Anything'))).toBe('px')
    expect(variableUnit(token('Fade', { scopes: ['OPACITY'] }))).toBe('none')
    expect(variableUnit(token('Bold', { scopes: ['FONT_STYLE'] }))).toBe('none')
    expect(variableUnit(token('Weight/bold'))).toBe('none')
    expect(variableUnit(token('Space/small', { unit: 'rem' }))).toBe('rem')
    expect(variableUnit(token('Gray', { type: 'COLOR' }))).toBe('none')
  })

  test('write stored numbers in their unit', () => {
    expect(tokenNumberToCSS(24, 'rem')).toBe('1.5rem')
    expect(tokenNumberToCSS(0.5, 'rem')).toBe('0.03125rem')
    expect(tokenNumberToCSS(8, 'px')).toBe('8px')
    expect(tokenNumberToCSS(0, 'px')).toBe('0')
    expect(tokenNumberToCSS(150, 'ms')).toBe('150ms')
    expect(tokenNumberToCSS(0.1 + 0.2, 'none')).toBe('0.3')
  })
})
