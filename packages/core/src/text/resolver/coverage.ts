import { fontFallbackScriptForCharacter } from '#core/text/coverage'
import type { FontFallbackScript } from '#core/text/fallbacks'

export interface ObservedShapedLine {
  textRange: { last: number }
  runs: Array<{ glyphs: Uint16Array; offsets: Uint32Array }>
}

interface CodePointSpan {
  character: string
  utf8Start: number
  utf16Start: number
}

function codePointSpans(text: string): { spans: CodePointSpan[]; utf8Length: number } {
  const spans: CodePointSpan[] = []
  let utf8Start = 0
  let utf16Start = 0
  const encoder = new TextEncoder()

  for (const character of text) {
    spans.push({ character, utf8Start, utf16Start })
    utf8Start += encoder.encode(character).byteLength
    utf16Start += character.length
  }

  return { spans, utf8Length: utf8Start }
}

export interface MissingGlyphOccurrence {
  character: string
  utf16Start: number
}

export function missingGlyphOccurrences(
  text: string,
  lines: readonly ObservedShapedLine[],
  sourceOffsets?: readonly number[]
): MissingGlyphOccurrence[] {
  if (!text || lines.length === 0) return []
  const { spans, utf8Length } = codePointSpans(text)
  const sourceText = text
  const sourceSpans = codePointSpans(sourceText).spans
  const finalLine = lines.at(-1)
  const finalOffset = finalLine ? finalLine.textRange.last : undefined
  const offsetsAreUtf16 = finalOffset === text.length && utf8Length !== text.length
  const spansByOffset = new Map<number, MissingGlyphOccurrence>()
  for (const [index, span] of spans.entries()) {
    const sourceIndex =
      sourceOffsets?.[index] ?? sourceSpans[Math.min(index, sourceSpans.length - 1)].utf16Start
    spansByOffset.set(offsetsAreUtf16 ? span.utf16Start : span.utf8Start, {
      character: span.character,
      utf16Start: sourceIndex
    })
  }

  const missing = new Map<string, MissingGlyphOccurrence>()
  for (const line of lines) {
    for (const run of line.runs) {
      for (let index = 0; index < run.glyphs.length; index++) {
        if (run.glyphs[index] !== 0) continue
        const occurrence = spansByOffset.get(run.offsets[index])
        if (occurrence) missing.set(`${occurrence.utf16Start}\0${occurrence.character}`, occurrence)
      }
    }
  }
  return [...missing.values()]
}

export function missingGlyphCharacters(
  text: string,
  lines: readonly ObservedShapedLine[]
): string[] {
  return missingGlyphOccurrences(text, lines).map(({ character }) => character)
}

export function missingGlyphScripts(
  text: string,
  lines: readonly ObservedShapedLine[]
): FontFallbackScript[] {
  const scripts = new Set<FontFallbackScript>()
  for (const character of missingGlyphCharacters(text, lines)) {
    const script = fontFallbackScriptForCharacter(character)
    if (script) scripts.add(script)
  }
  return [...scripts]
}
