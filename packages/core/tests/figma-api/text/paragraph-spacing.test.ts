import { describe, expect, test } from 'bun:test'

import { FigmaAPI, SceneGraph } from '@open-pencil/core'

// Results recorded from the same scripts run in live Figma (2026-10-10).
function spacedText(characters = 'A\nB\nC') {
  const api = new FigmaAPI(new SceneGraph())
  const text = api.createText()
  text.characters = characters
  return { api, text }
}

/** Each paragraph's spacing, read one paragraph at a time. */
function perParagraph(
  text: ReturnType<typeof spacedText>['text'],
  read: (start: number, end: number) => number | symbol
) {
  let start = 0
  return text.characters.split('\n').map((line) => {
    const value = read(start, start + Math.max(1, line.length))
    start += line.length + 1
    return value
  })
}

describe('paragraph spacing ranges', () => {
  test('reach the paragraph at the end of the range, unlike list options', () => {
    const cases: Array<[number, number, number[]]> = [
      [0, 1, [9, 0, 0]],
      [0, 2, [9, 9, 0]],
      [1, 2, [9, 9, 0]],
      [1, 3, [9, 9, 0]],
      [2, 3, [0, 9, 0]],
      [3, 4, [0, 9, 9]],
      [0, 4, [9, 9, 9]]
    ]
    for (const [start, end, expected] of cases) {
      const { text } = spacedText()
      text.setRangeParagraphSpacing(start, end, 9)
      text.setRangeParagraphIndent(start, end, 9)
      expect(perParagraph(text, (s, e) => text.getRangeParagraphSpacing(s, e))).toEqual(expected)
      expect(perParagraph(text, (s, e) => text.getRangeParagraphIndent(s, e))).toEqual(expected)
    }
  })

  test('read mixed across differing paragraphs, on the range and the text', () => {
    const { api, text } = spacedText()
    text.setRangeParagraphSpacing(0, 1, 20)
    expect(text.getRangeParagraphSpacing(0, 3)).toBe(api.mixed)
    expect(text.getRangeParagraphSpacing(0, 1)).toBe(20)
    expect<number | symbol>(text.paragraphSpacing).toBe(api.mixed)
    expect(text.listSpacing).toBe(0)
  })

  test('setting the text keeps paragraphs that set their own', () => {
    const { text } = spacedText()
    text.setRangeParagraphSpacing(0, 1, 20)
    text.paragraphSpacing = 5
    expect(perParagraph(text, (s, e) => text.getRangeParagraphSpacing(s, e))).toEqual([20, 5, 5])
  })

  test('reject what Figma rejects, with its messages', () => {
    const { text } = spacedText()
    expect(() => text.setRangeParagraphSpacing(0, 1, -3)).toThrow(
      'in setRangeParagraphSpacing: Property "value" failed validation: Number must be greater than or equal to 0'
    )
    expect(() => text.setRangeParagraphIndent(0, 1, -3)).toThrow(
      'in setRangeParagraphIndent: Property "value" failed validation'
    )
    expect(() => text.setRangeListSpacing(0, 1, -3)).toThrow(
      'in setRangeListSpacing: Property "value" failed validation'
    )
    expect(() => text.setRangeParagraphSpacing(0, 99, 3)).toThrow(
      "in setRangeParagraphSpacing: Range outside of available characters. 'start' must be less than node.characters.length and 'end' must be less than or equal to node.characters.length"
    )
    expect(() => text.setRangeParagraphSpacing(1, 1, 3)).toThrow(
      "in setRangeParagraphSpacing: Empty range selected. 'end' must be greater than 'start'"
    )
    expect(() => text.getRangeParagraphSpacing(1, 1)).toThrow(
      "in getRangeParagraphSpacing: Empty range selected. 'end' must be greater than 'start'"
    )
    text.setRangeParagraphSpacing(0, 1, 2.5)
    expect(text.getRangeParagraphSpacing(0, 1)).toBe(2.5)
  })

  test('follow the paragraphs through text edits', () => {
    const { text } = spacedText()
    text.setRangeParagraphSpacing(1, 2, 7)
    text.characters = 'X\nY'
    expect(perParagraph(text, (s, e) => text.getRangeParagraphSpacing(s, e))).toEqual([7, 7])
    text.setRangeParagraphSpacing(0, 1, 30)
    text.insertCharacters(1, '\nZ')
    expect(perParagraph(text, (s, e) => text.getRangeParagraphSpacing(s, e))).toEqual([
      30, 30, 7
    ])
  })
})
