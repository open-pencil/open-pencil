/** Bytes a code point takes in UTF-8. */
function utf8Width(codePoint: number): number {
  if (codePoint < 0x80) return 1
  if (codePoint < 0x800) return 2
  if (codePoint < 0x10000) return 3
  return 4
}

/** The length of `text` in UTF-8 bytes, the unit of CanvasKit's glyph run offsets. */
export function utf8Length(text: string): number {
  let length = 0
  for (const character of text) length += utf8Width(character.codePointAt(0) ?? 0)
  return length
}

/**
 * UTF-16 indices of the text by UTF-8 byte offset: CanvasKit reports glyph runs in bytes.
 * Offsets inside a character map to its start.
 */
export function utf16IndicesByUtf8(text: string): (offset: number) => number {
  const indices: number[] = []
  let utf16 = 0
  for (const character of text) {
    const bytes = utf8Width(character.codePointAt(0) ?? 0)
    for (let byte = 0; byte < bytes; byte++) indices.push(utf16)
    utf16 += character.length
  }
  return (offset) => indices[offset] ?? text.length
}
