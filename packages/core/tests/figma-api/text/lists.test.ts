import { describe, expect, test } from 'bun:test'

import { FigmaAPI, SceneGraph } from '@open-pencil/core'

// Results recorded from the same scripts run in live Figma (2026-10-09).
function listText(characters: string) {
  const api = new FigmaAPI(new SceneGraph())
  const text = api.createText()
  text.characters = characters
  return { api, text }
}

function segments(text: ReturnType<typeof listText>['text']) {
  const lines = text.characters.split('\n')
  let start = 0
  return lines.map((line, index) => {
    const end = start + line.length + (index < lines.length - 1 ? 1 : 0)
    const options = text.getRangeListOptions(start, end)
    const indentation = text.getRangeIndentation(start, end)
    start = end
    return [
      typeof options === 'symbol' ? 'MIXED' : options.type,
      typeof indentation === 'symbol' ? 'MIXED' : indentation
    ]
  })
}

describe('text lists', () => {
  test('reads a range by the paragraphs it touches, and mixed across them', () => {
    const { api, text } = listText('ab\ncd\nef')
    text.setRangeListOptions(3, 5, { type: 'ORDERED' })

    expect(text.getRangeListOptions(0, 3)).toEqual({ type: 'NONE' })
    // A newline belongs to the paragraph it ends.
    expect(text.getRangeListOptions(2, 3)).toEqual({ type: 'NONE' })
    expect(text.getRangeListOptions(2, 4)).toBe(api.mixed)
    expect(text.getRangeListOptions(3, 4)).toEqual({ type: 'ORDERED' })
    expect(text.getRangeIndentation(0, 2)).toBe(0)
    expect(text.getRangeIndentation(3, 5)).toBe(1)
    expect(text.getRangeIndentation(0, 8)).toBe(api.mixed)
  })

  test('nests list items one to five levels and leaves a list at level zero', () => {
    const { text } = listText('a\nb\nc')
    text.setRangeListOptions(0, 5, { type: 'UNORDERED' })
    text.setRangeIndentation(2, 3, 3)
    text.setRangeIndentation(4, 5, 0)
    expect(segments(text)).toEqual([
      ['UNORDERED', 1],
      ['UNORDERED', 3],
      ['UNORDERED', 1]
    ])
    text.setRangeListOptions(2, 3, { type: 'NONE' })
    expect(segments(text)[1]).toEqual(['NONE', 0])
    // A plain paragraph keeps an indentation, though it draws none.
    text.setRangeIndentation(2, 3, 2)
    expect(segments(text)[1]).toEqual(['NONE', 2])
  })

  test('continues a list into inserted paragraphs and gives replaced text the first style', () => {
    const { text } = listText('a\nb')
    text.setRangeListOptions(0, 3, { type: 'UNORDERED' })
    text.insertCharacters(1, '\nnew')
    text.insertCharacters(text.characters.length, '\nend')
    expect(segments(text)).toEqual([
      ['UNORDERED', 1],
      ['UNORDERED', 1],
      ['UNORDERED', 1],
      ['UNORDERED', 1]
    ])

    text.setRangeListOptions(0, 1, { type: 'ORDERED' })
    text.setRangeIndentation(2, 3, 2)
    text.characters = 'x\ny\nz'
    expect(segments(text)).toEqual([
      ['ORDERED', 1],
      ['ORDERED', 1],
      ['ORDERED', 1]
    ])
  })

  test('rejects ranges, list types, and levels as Figma does', () => {
    const { text } = listText('ab\ncd\nef')
    expect(() => text.getRangeListOptions(0, 0)).toThrow(
      "in getRangeListOptions: Empty range selected. 'end' must be greater than 'start'"
    )
    expect(() => text.getRangeListOptions(-1, 2)).toThrow(
      'in getRangeListOptions: Property "start" failed validation: Number must be greater than or equal to 0'
    )
    expect(() => text.getRangeListOptions(0, 99)).toThrow(
      'in getRangeListOptions: Range outside of available characters.'
    )
    expect(() =>
      text.setRangeListOptions(0, 1, { type: 'BULLET' as TextListOptions['type'] })
    ).toThrow("Expected 'NONE' | 'ORDERED' | 'UNORDERED', received 'BULLET' at .type")
    expect(() => text.setRangeIndentation(6, 8, -1)).toThrow(
      'Number must be greater than or equal to 0'
    )
    expect(() => text.setRangeIndentation(3, 5, 2.5)).toThrow('Expected integer, received float')
    expect(() => text.setRangeIndentation(0, 2, 9)).toThrow(
      'Number must be less than or equal to 5'
    )
  })

  test('sets list and paragraph spacing, indent, and hanging markers', () => {
    const { text } = listText('a\nb')
    expect([
      text.listSpacing,
      text.paragraphSpacing,
      text.paragraphIndent,
      text.hangingList
    ]).toEqual([0, 0, 0, false])
    text.listSpacing = 10
    text.paragraphSpacing = 4.5
    text.paragraphIndent = 20
    text.hangingList = true
    expect([
      text.listSpacing,
      text.paragraphSpacing,
      text.paragraphIndent,
      text.hangingList
    ]).toEqual([10, 4.5, 20, true])
    expect(() => {
      text.listSpacing = -3
    }).toThrow(
      'in set_listSpacing: Property "listSpacing" failed validation: Number must be greater than or equal to 0'
    )
  })
})
