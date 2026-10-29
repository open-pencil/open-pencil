import { describe, expect, test } from 'bun:test'

import type { StyleRun, TextCase } from '@open-pencil/scene-graph'
import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'

import { shownCharacters, shownText, shownTextSlice } from '#core/text/case'

function text(characters: string, styleRuns: StyleRun[], textCase: TextCase = 'ORIGINAL') {
  return createDefaultNode(() => 'text', 'TEXT', { text: characters, styleRuns, textCase })
}

describe('text case by range', () => {
  test('show each range in its own case and the rest in the text case', () => {
    const node = text('upper then lower', [{ start: 0, length: 5, style: { textCase: 'UPPER' } }])
    expect(shownText(node)).toBe('UPPER then lower')
    expect(shownTextSlice(node, 3, 8)).toBe('ER th')

    const cased = text(
      'LOUD AND quiet',
      [{ start: 9, length: 5, style: { textCase: 'LOWER' } }],
      'UPPER'
    )
    expect(shownText(cased)).toBe('LOUD AND quiet')
  })

  test('capitalize only words a title-cased range starts', () => {
    const node = text('midword and more', [
      { start: 3, length: 4, style: { textCase: 'TITLE' } },
      { start: 8, length: 8, style: { textCase: 'TITLE' } }
    ])
    expect(shownText(node)).toBe('midword And More')

    const marked = text('a\u0301bc de', [{ start: 1, length: 6, style: { textCase: 'TITLE' } }])
    expect(shownText(marked)).toBe('a\u0301bc De')
  })

  test('map every shown character back to the character it comes from', () => {
    const node = text('aß b', [{ start: 0, length: 2, style: { textCase: 'UPPER' } }])
    expect(shownText(node)).toBe('ASS b')
    expect(shownCharacters(node).map((shown) => shown.sourceIndex)).toEqual([0, 1, 1, 2, 3])
  })

  test('show each character as its whole word is cased, final sigma and astral letters too', () => {
    const greek = text('AΟΣ', [{ start: 0, length: 3, style: { textCase: 'TITLE' } }])
    expect(shownText(greek)).toBe('Aος')
    expect(
      shownCharacters(greek)
        .map((shown) => shown.character)
        .join('')
    ).toBe('Aος')

    const deseret = text('𐐨𐐨', [{ start: 0, length: 4, style: { textCase: 'TITLE' } }])
    expect(shownText(deseret)).toBe('𐐀𐐨')
    expect(shownCharacters(deseret).map((shown) => shown.sourceIndex)).toEqual([0, 2])
  })
})
