import { describe, expect, test } from 'bun:test'

import {
  parseCSSFontFamilies,
  parseCSSFontFamily,
  parseCSSLetterSpacing,
  parseCSSLineHeight,
  resolveCSSFontFamily
} from '@open-pencil/scene-graph/css'
import { percentLength, pixelLength } from '@open-pencil/scene-graph/text'

describe('parseCSSFontFamily', () => {
  test.each([
    ["'Noto Sans KR', sans-serif", 'Noto Sans KR'],
    ['"Fira Code", monospace', 'Fira Code'],
    ['"Foo, Bar", serif', 'Foo, Bar'],
    ['"O\'Reilly"', "O'Reilly"],
    ['Noto   Sans KR, Arial', 'Noto Sans KR'],
    ["O'Reilly, Arial", "O'Reilly"],
    ["'O\\'Reilly', serif", "O'Reilly"],
    ['"A\\26 B"', 'A&B'],
    ['Foo\\,Bar, serif', 'Foo,Bar'],
    ['Inter', 'Inter'],
    ['', null]
  ])('%s', (value, expected) => {
    expect(parseCSSFontFamily(value)).toBe(expected)
  })
})

describe('parseCSSFontFamilies', () => {
  test('reads every family in order, quoted or not', () => {
    expect(parseCSSFontFamilies(`"Foo, Bar", O'Reilly, 'Noto\\26 Sans', sans-serif`)).toEqual([
      { name: 'Foo, Bar', quoted: true },
      { name: "O'Reilly", quoted: false },
      { name: 'Noto&Sans', quoted: true },
      { name: 'sans-serif', quoted: false }
    ])
  })

  test('skips empty entries', () => {
    expect(parseCSSFontFamilies(' , Inter ,, ')).toEqual([{ name: 'Inter', quoted: false }])
    expect(parseCSSFontFamilies(undefined)).toEqual([])
  })
})

describe('resolveCSSFontFamily', () => {
  test.each([
    ['system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', 'Inter'],
    ['-apple-system, BlinkMacSystemFont, sans-serif', 'Inter'],
    ['BlinkMacSystemFont, sans-serif', 'Inter'],
    ['Sans-Serif', 'Inter'],
    ['serif', 'Merriweather'],
    ['ui-monospace, SFMono-Regular, Menlo, monospace', 'Roboto Mono'],
    ['monospace', 'Roboto Mono'],
    ['"serif", sans-serif', 'serif'],
    ['"Helvetica Neue", Arial, sans-serif', 'Helvetica Neue'],
    ['', null]
  ])('%s', (value, expected) => {
    expect(resolveCSSFontFamily(value)).toBe(expected)
  })
})

describe('parseCSSLineHeight', () => {
  test.each([
    ['1.5', percentLength(150)],
    ['120%', percentLength(120)],
    ['24px', pixelLength(24)],
    ['1.5rem', pixelLength(24)],
    ['normal', null],
    ['2em', percentLength(200)],
    ['2vh', undefined],
    ['', undefined]
  ])('%s', (value, expected) => {
    expect(parseCSSLineHeight(value)).toEqual(expected)
  })
})

describe('parseCSSLetterSpacing', () => {
  test.each([
    ['0.1em', percentLength(10)],
    ['2px', pixelLength(2)],
    ['normal', pixelLength(0)],
    ['10%', undefined]
  ])('%s', (value, expected) => {
    expect(parseCSSLetterSpacing(value)).toEqual(expected)
  })
})
