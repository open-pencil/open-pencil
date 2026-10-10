import type { TextParagraphStyle } from '../types'
import { paragraphStyleAt, textParagraphRanges, type TextParagraphRange } from './paragraphs'

/** How an ordered item's number is written at its nesting level. */
export type ListNumberFormat = 'DECIMAL' | 'LOWER_ALPHA' | 'LOWER_ROMAN'

/** A list item paragraph and what marks it. */
export interface TextListItem extends TextParagraphRange {
  paragraph: number
  listType: 'ORDERED' | 'UNORDERED'
  /** Nesting level, from 1. */
  level: number
  /** The item's number among the items of its list at its level, from 1. */
  ordinal: number
  /** The marker drawn before the item: a bullet, or its number and a period. */
  marker: string
  /** Whether the item starts a new count at its level. */
  startsList: boolean
  /**
   * The paragraph that starts the group of list items this item belongs to. A list group runs
   * from a list item that follows a plain paragraph, or that starts a top-level list, and its
   * first character styles every marker and indent in it.
   */
  groupStart: number
}

/** The marker of an unordered item, at every level. */
export const LIST_BULLET = '•'

const NUMBER_FORMATS: readonly ListNumberFormat[] = ['DECIMAL', 'LOWER_ALPHA', 'LOWER_ROMAN']

/** Ordered items count in decimal, then letters, then roman numerals, repeating as they nest. */
export function listNumberFormat(level: number): ListNumberFormat {
  return NUMBER_FORMATS[(Math.max(1, level) - 1) % NUMBER_FORMATS.length]
}

function alphabetic(value: number): string {
  let letters = ''
  for (let rest = value; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    letters = String.fromCharCode(97 + ((rest - 1) % 26)) + letters
  }
  return letters
}

const ROMAN_DIGITS: ReadonlyArray<readonly [number, string]> = [
  [1000, 'm'],
  [900, 'cm'],
  [500, 'd'],
  [400, 'cd'],
  [100, 'c'],
  [90, 'xc'],
  [50, 'l'],
  [40, 'xl'],
  [10, 'x'],
  [9, 'ix'],
  [5, 'v'],
  [4, 'iv'],
  [1, 'i']
]

function roman(value: number): string {
  let rest = value
  let numeral = ''
  for (const [amount, digits] of ROMAN_DIGITS) {
    for (; rest >= amount; rest -= amount) numeral += digits
  }
  return numeral
}

/** An ordered item's number as its level writes it, without the period. */
export function formatListNumber(ordinal: number, format: ListNumberFormat): string {
  if (format === 'LOWER_ALPHA') return alphabetic(ordinal)
  if (format === 'LOWER_ROMAN') return roman(ordinal)
  return String(ordinal)
}

interface LevelCount {
  listType: TextListItem['listType']
  count: number
}

/**
 * The list items of a text, numbered as Figma numbers them: each level counts its own items,
 * a deeper item leaves the count above it running, a shallower one restarts the counts below
 * it, and a plain paragraph or an item of the other list type restarts the count.
 */
export function textListItems(
  text: string,
  paragraphs: readonly TextParagraphStyle[]
): TextListItem[] {
  if (!paragraphs.some((paragraph) => paragraph.listType !== 'NONE')) return []
  const items: TextListItem[] = []
  const counts: Array<LevelCount | undefined> = []
  let groupStart = -1
  for (const [paragraph, range] of textParagraphRanges(text).entries()) {
    const style = paragraphStyleAt(paragraphs, paragraph)
    if (style.listType === 'NONE') {
      counts.length = 0
      groupStart = -1
      continue
    }
    const level = Math.max(1, style.indentation)
    counts.length = Math.min(counts.length, level)
    const current = counts[level - 1]
    const continues = current?.listType === style.listType
    const count = continues ? current.count + 1 : 1
    counts[level - 1] = { listType: style.listType, count }
    const shallower = counts.slice(0, level - 1).some((entry) => entry !== undefined)
    if (groupStart === -1 || (!continues && !shallower)) groupStart = paragraph
    const marker =
      style.listType === 'UNORDERED'
        ? LIST_BULLET
        : `${formatListNumber(count, listNumberFormat(level))}.`
    items.push({
      ...range,
      paragraph,
      listType: style.listType,
      level,
      ordinal: count,
      marker,
      startsList: !continues,
      groupStart
    })
  }
  return items
}

/**
 * Digits in the largest number of a top-level ordered item. Figma widens the indent of every
 * ordered item by the extra digits, so a list's numbers line up past nine.
 */
export function topLevelNumberDigits(items: readonly TextListItem[]): number {
  let largest = 0
  for (const item of items) {
    if (item.listType === 'ORDERED' && item.level === 1) largest = Math.max(largest, item.ordinal)
  }
  return largest === 0 ? 0 : String(largest).length
}
