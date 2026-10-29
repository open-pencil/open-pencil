import { describe, expect, test } from 'bun:test'

import {
  parseCSSFontFamily,
  parseCSSLetterSpacing,
  parseCSSLineHeight
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
