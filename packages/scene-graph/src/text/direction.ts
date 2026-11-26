import type { LayoutDirection, SceneNode, TextDirection } from '../types'

const RTL_CHAR_RE =
  /\p{Script=Arabic}|\p{Script=Hebrew}|\p{Script=Syriac}|\p{Script=Thaana}|\p{Script=Nko}|\p{Script=Adlam}/u
const LTR_CHAR_RE = /\p{Script=Latin}|\p{Script=Cyrillic}|\p{Script=Greek}/u

/** Whether the text has a letter of a right-to-left script, such as Arabic or Hebrew. */
export function containsRTLText(text: string): boolean {
  return RTL_CHAR_RE.test(text)
}

export function detectTextDirection(text: string): Exclude<TextDirection, 'AUTO'> {
  for (const char of text) {
    if (RTL_CHAR_RE.test(char)) return 'RTL'
    if (LTR_CHAR_RE.test(char)) return 'LTR'
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
