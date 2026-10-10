import { describe, expect, test } from 'bun:test'

import {
  paragraphSpacingAt,
  paragraphStylesAfterEdit,
  paragraphStylesWithoutSpacing,
  sharedParagraphSpacing,
  trimParagraphStyles,
  withListType,
  withParagraphSpacing,
  type TextParagraphStyle
} from '@open-pencil/scene-graph'

const plain: TextParagraphStyle = { listType: 'NONE', indentation: 0 }
const node = (textParagraphs: TextParagraphStyle[]) => ({
  text: 'A\nB\nC',
  textParagraphs,
  listSpacing: 4,
  paragraphSpacing: 10,
  paragraphIndent: 0
})

describe('paragraph spacing', () => {
  test('follows the text unless a paragraph sets its own', () => {
    const spaced = node([plain, { ...plain, paragraphSpacing: 25 }])
    expect([0, 1, 2].map((index) => paragraphSpacingAt(spaced, index, 'paragraphSpacing'))).toEqual(
      [10, 25, 10]
    )
    expect(sharedParagraphSpacing(spaced, 'paragraphSpacing')).toBeNull()
    expect(sharedParagraphSpacing(spaced, 'paragraphSpacing', 2, 2)).toBe(10)
    expect(sharedParagraphSpacing(spaced, 'listSpacing')).toBe(4)
  })

  test('is kept by trimming, list changes, and edits', () => {
    const own = withParagraphSpacing(plain, 'paragraphIndent', 30)
    expect(trimParagraphStyles([plain, own], 2)).toEqual([plain, own])
    expect(withListType(own, 'ORDERED')).toEqual({
      listType: 'ORDERED',
      indentation: 1,
      paragraphIndent: 30
    })
    expect(withListType(withListType(own, 'ORDERED'), 'NONE')).toEqual(own)
    // A paragraph typed after one with its own spacing takes it, as Figma does.
    expect(paragraphStylesAfterEdit([own], 'A', 1, 1, '\nZ')).toEqual([own, own])
  })

  test('follows the text again once the text sets it for every paragraph', () => {
    const styles = [withParagraphSpacing(plain, 'paragraphSpacing', 25)]
    expect(withParagraphSpacing(styles[0], 'paragraphSpacing', undefined)).toEqual(plain)
    expect(paragraphStylesWithoutSpacing(styles, 'paragraphSpacing')).toEqual([])
    expect(paragraphStylesWithoutSpacing(styles, 'listSpacing')).toEqual(styles)
  })
})
