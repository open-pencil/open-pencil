import { describe, expect, test } from 'bun:test'

import {
  paragraphStylesAfterEdit,
  paragraphStylesAfterTextChange,
  paragraphStylesInRange,
  textListItems,
  topLevelNumberDigits,
  withIndentation,
  withListType,
  type TextParagraphStyle
} from '@open-pencil/scene-graph'

const ol = (indentation = 1): TextParagraphStyle => ({ listType: 'ORDERED', indentation })
const ul = (indentation = 1): TextParagraphStyle => ({ listType: 'UNORDERED', indentation })
const plain: TextParagraphStyle = { listType: 'NONE', indentation: 0 }

function markers(paragraphs: TextParagraphStyle[]) {
  const text = paragraphs.map((_, index) => `p${index}`).join('\n')
  return textListItems(text, paragraphs).map((item) => item.marker)
}

// Numbers as Figma drew them in live probes (2026-10-09).
describe('list numbering', () => {
  test('nests decimal, letters, and roman numerals, and resumes the outer count', () => {
    expect(markers([ol(1), ol(2), ol(2), ol(3), ol(4), ol(5), ol(1)])).toEqual([
      '1.',
      'a.',
      'b.',
      'i.',
      '1.',
      'a.',
      '2.'
    ])
  })

  test('restarts after a plain paragraph and after an item of the other type', () => {
    expect(markers([ol(), ol(), plain, ol(), ol()])).toEqual(['1.', '2.', '1.', '2.'])
    expect(markers([ol(), ol(), ul(), ul(), ol()])).toEqual(['1.', '2.', '•', '•', '1.'])
  })

  test('counts letters past z and roman numerals past three', () => {
    const letters = markers([ol(1), ...Array.from({ length: 28 }, () => ol(2))])
    expect(letters.slice(-3)).toEqual(['z.', 'aa.', 'ab.'])
    const numerals = markers([ol(1), ol(2), ...Array.from({ length: 9 }, () => ol(3))])
    expect(numerals.slice(2)).toEqual(['i.', 'ii.', 'iii.', 'iv.', 'v.', 'vi.', 'vii.', 'viii.', 'ix.'])
  })

  test('styles markers from the first item of each list group', () => {
    const items = textListItems('a\nb\nc\nd\ne', [ul(), ol(), ol(2), plain, ul()])
    expect(items.map((item) => item.groupStart)).toEqual([0, 1, 1, 4])
  })

  test('widens by the digits of the largest top-level number only', () => {
    const items = textListItems(
      Array.from({ length: 13 }, (_, index) => `p${index}`).join('\n'),
      [ol(1), ...Array.from({ length: 12 }, () => ol(4))]
    )
    expect(topLevelNumberDigits(items)).toBe(1)
    const long = textListItems(
      Array.from({ length: 12 }, (_, index) => `p${index}`).join('\n'),
      Array.from({ length: 12 }, () => ol())
    )
    expect(topLevelNumberDigits(long)).toBe(2)
  })
})

describe('paragraph styles through edits', () => {
  test('continue the list into inserted paragraphs', () => {
    expect(paragraphStylesAfterEdit([ul(), ul()], 'a\nb', 1, 1, '\nnew')).toEqual([ul(), ul(), ul()])
    expect(paragraphStylesAfterEdit([plain, ol()], 'a\nb', 3, 3, '\nend')).toEqual([plain, ol(), ol()])
  })

  test('keep the first paragraph style when a newline is deleted', () => {
    expect(paragraphStylesAfterEdit([ul(), plain, ol()], 'a\nb\nc', 1, 2, '')).toEqual([ul(), ol()])
    expect(paragraphStylesAfterEdit([plain, ol()], 'a\nb', 1, 2, '')).toEqual([])
  })

  test('follow an editor that replaces the whole text', () => {
    // Enter at the end of an item, then joining the item back.
    expect(paragraphStylesAfterTextChange([plain, ol()], 'a\nb', 'a\nb\n')).toEqual([plain, ol(), ol()])
    expect(paragraphStylesAfterTextChange([ul(), ol()], 'a\nb', 'ab')).toEqual([ul()])
  })

  test('change whole paragraphs a range touches, not the one after its newline', () => {
    const next = paragraphStylesInRange([], 'a\nb\nc', 0, 2, (style) => withListType(style, 'ORDERED'))
    expect(next).toEqual([ol()])
  })

  test('keep list items nested one to five levels deep', () => {
    expect(withIndentation(ul(), 0)).toEqual(ul(1))
    expect(withIndentation(ul(), 9)).toEqual(ul(5))
    expect(withIndentation(plain, 2)).toEqual({ listType: 'NONE', indentation: 2 })
    expect(withListType(ol(3), 'NONE')).toEqual(plain)
  })
})
