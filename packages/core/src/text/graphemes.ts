/**
 * Boundaries of user-perceived characters, which the caret moves over and deletion removes
 * whole: an emoji sequence, a flag, or a surrogate pair is one, never split.
 */
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** The boundary after the character at `index`, or the text's end. */
export function nextGraphemeBoundary(text: string, index: number): number {
  if (index >= text.length) return text.length
  const segment = graphemes.segment(text).containing(index)
  return segment ? segment.index + segment.segment.length : text.length
}

/** The boundary before the character that ends at `index`, or the text's start. */
export function previousGraphemeBoundary(text: string, index: number): number {
  if (index <= 0) return 0
  return graphemes.segment(text).containing(Math.min(index, text.length) - 1)?.index ?? 0
}
