import bidiFactory from 'bidi-js'

import type { LayoutDirection, SceneNode, TextDirection } from '../types'

const RTL_CHAR_RE =
  /\p{Script=Arabic}|\p{Script=Hebrew}|\p{Script=Syriac}|\p{Script=Thaana}|\p{Script=Nko}|\p{Script=Adlam}/u

/** Whether the text has a letter of a right-to-left script, such as Arabic or Hebrew. */
export function containsRTLText(text: string): boolean {
  return RTL_CHAR_RE.test(text)
}

let bidi: ReturnType<typeof bidiFactory> | undefined

/**
 * The direction of the text's first strongly directional character, as the Unicode bidi
 * algorithm and Figma pick a paragraph's: digits, number signs, marks, and punctuation before
 * it do not count.
 */
export function detectTextDirection(text: string): Exclude<TextDirection, 'AUTO'> {
  bidi ??= bidiFactory()
  for (const char of text) {
    const type = bidi.getBidiCharTypeName(char)
    if (type === 'L') return 'LTR'
    if (type === 'R' || type === 'AL') return 'RTL'
  }
  return 'LTR'
}

export function resolveTextDirection(
  direction: TextDirection,
  text: string
): Exclude<TextDirection, 'AUTO'> {
  return direction === 'AUTO' ? detectTextDirection(text) : direction
}

export function resolveNodeTextDirection(
  node: Pick<SceneNode, 'textDirection' | 'text'>
): 'LTR' | 'RTL' {
  return resolveTextDirection(node.textDirection, node.text)
}

export function resolveNodeLayoutDirection(
  node: { layoutDirection?: LayoutDirection },
  inheritedDirection: Exclude<LayoutDirection, 'AUTO'> = 'LTR'
): Exclude<LayoutDirection, 'AUTO'> {
  return !node.layoutDirection || node.layoutDirection === 'AUTO'
    ? inheritedDirection
    : node.layoutDirection
}
