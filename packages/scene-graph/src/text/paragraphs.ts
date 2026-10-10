import type { SceneNode, TextListType, TextParagraphStyle } from '../types'

/** The style of a paragraph with no entry: not in a list. */
export const PLAIN_PARAGRAPH: Readonly<TextParagraphStyle> = Object.freeze({
  listType: 'NONE',
  indentation: 0
})

/** Figma nests list items at most this deep. */
export const MAX_LIST_INDENTATION = 5

/** A paragraph's characters: `start` to `end`, not counting the newline that ends it. */
export interface TextParagraphRange {
  start: number
  end: number
}

/** The paragraphs of `text`: one per line ending at a newline, and one after the last. */
export function textParagraphRanges(text: string): TextParagraphRange[] {
  const ranges: TextParagraphRange[] = []
  let start = 0
  for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', start)) {
    ranges.push({ start, end: index })
    start = index + 1
  }
  ranges.push({ start, end: text.length })
  return ranges
}

/** The paragraph holding character `index`; a newline belongs to the paragraph it ends. */
export function paragraphIndexAt(text: string, index: number): number {
  let paragraph = 0
  const end = Math.min(index, text.length)
  for (let at = text.indexOf('\n'); at !== -1 && at < end; at = text.indexOf('\n', at + 1)) {
    paragraph++
  }
  return paragraph
}

export function paragraphStyleAt(
  paragraphs: readonly TextParagraphStyle[],
  paragraph: number
): TextParagraphStyle {
  return paragraphs[paragraph] ?? PLAIN_PARAGRAPH
}

/** Whether any paragraph of the node is a list item. */
export function hasTextList(node: Pick<SceneNode, 'textParagraphs'>): boolean {
  return node.textParagraphs.some((paragraph) => paragraph.listType !== 'NONE')
}

/**
 * Paragraph styles for `count` paragraphs, without the plain paragraphs at the end, so text
 * without lists or indentation keeps none.
 */
export function trimParagraphStyles(
  paragraphs: readonly TextParagraphStyle[],
  count: number
): TextParagraphStyle[] {
  const styles = paragraphs.slice(0, count).map((paragraph) => ({ ...paragraph }))
  while (styles.length > 0) {
    const last = styles[styles.length - 1]
    if (last.listType !== 'NONE' || last.indentation !== 0) break
    styles.pop()
  }
  return styles
}

function paragraphCount(text: string): number {
  let count = 1
  for (let at = text.indexOf('\n'); at !== -1; at = text.indexOf('\n', at + 1)) count++
  return count
}

/**
 * Paragraph styles after replacing `text[start, end)` with `inserted`, as Figma keeps them: the
 * paragraph the edit starts in keeps its style, paragraphs a deleted newline joins to it are
 * dropped, and paragraphs an inserted newline starts take its style.
 */
export function paragraphStylesAfterEdit(
  paragraphs: readonly TextParagraphStyle[],
  text: string,
  start: number,
  end: number,
  inserted: string
): TextParagraphStyle[] {
  if (paragraphs.length === 0) return []
  const first = paragraphIndexAt(text, start)
  const last = paragraphIndexAt(text, end)
  const style = paragraphStyleAt(paragraphs, first)
  const added = paragraphCount(inserted) - 1
  const next = [
    ...Array.from({ length: first }, (_, index) => paragraphStyleAt(paragraphs, index)),
    ...Array.from({ length: added + 1 }, () => style),
    ...paragraphs.slice(last + 1)
  ]
  return trimParagraphStyles(next, paragraphCount(text) - (last - first) + added)
}

/**
 * Paragraph styles with every paragraph that `text[start, end)` touches changed by `change`,
 * as a range setter changes whole paragraphs.
 */
export function paragraphStylesInRange(
  paragraphs: readonly TextParagraphStyle[],
  text: string,
  start: number,
  end: number,
  change: (style: TextParagraphStyle) => TextParagraphStyle
): TextParagraphStyle[] {
  const count = paragraphCount(text)
  const first = paragraphIndexAt(text, start)
  // An empty range still names the paragraph it sits in; a range ending right after a
  // newline does not reach into the next paragraph.
  const last = end > start ? paragraphIndexAt(text, end - 1) : first
  const next = Array.from({ length: count }, (_, index) => {
    const style = paragraphStyleAt(paragraphs, index)
    return index >= first && index <= last ? change(style) : style
  })
  return trimParagraphStyles(next, count)
}

/**
 * A paragraph style with its list type set. A list item is nested at least one level, and a
 * paragraph leaving a list keeps no indentation.
 */
export function withListType(
  style: TextParagraphStyle,
  listType: TextListType
): TextParagraphStyle {
  if (listType === 'NONE') return { listType, indentation: 0 }
  return { listType, indentation: clampListIndentation(style.indentation) }
}

/** A paragraph style with its nesting set, kept in the range a list item allows. */
export function withIndentation(
  style: TextParagraphStyle,
  indentation: number
): TextParagraphStyle {
  if (style.listType === 'NONE') {
    return {
      ...style,
      indentation: Math.max(0, Math.min(MAX_LIST_INDENTATION, Math.round(indentation)))
    }
  }
  return { ...style, indentation: clampListIndentation(indentation) }
}

function clampListIndentation(indentation: number): number {
  return Math.max(1, Math.min(MAX_LIST_INDENTATION, Math.round(indentation)))
}

/**
 * Paragraph styles after `before` became `after` through one edit, found as the text between
 * their common start and end, for editors that replace the text rather than report the edit.
 */
export function paragraphStylesAfterTextChange(
  paragraphs: readonly TextParagraphStyle[],
  before: string,
  after: string
): TextParagraphStyle[] {
  if (paragraphs.length === 0 || before === after) return paragraphs.map((style) => ({ ...style }))
  let prefix = 0
  const shorter = Math.min(before.length, after.length)
  while (prefix < shorter && before[prefix] === after[prefix]) prefix++
  let suffix = 0
  while (
    suffix < shorter - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix++
  }
  return paragraphStylesAfterEdit(
    paragraphs,
    before,
    prefix,
    before.length - suffix,
    after.slice(prefix, after.length - suffix)
  )
}
