import type { SceneNode, TextCase } from '@lawha/scene-graph'

type CasedText = Pick<SceneNode, 'text' | 'textCase' | 'styleRuns'>

const WORD = /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu
const WORD_END = /[\p{L}\p{M}\p{N}]$/u
const WORD_REST = /^[\p{L}\p{M}\p{N}]+/u

/** A word with its first character, which may be astral, in upper case and the rest in lower. */
function capitalized(word: string): string {
  const first = String.fromCodePoint(word.codePointAt(0) ?? 0)
  return first.toLocaleUpperCase() + word.slice(first.length).toLocaleLowerCase()
}

/**
 * `text` in `textCase`. Title case capitalizes each word; a stretch that `continuesWord` starts
 * inside a word, so its first word goes on in lower case.
 */
export function transformTextCase(text: string, textCase: TextCase, continuesWord = false): string {
  if (textCase === 'UPPER') return text.toLocaleUpperCase()
  if (textCase === 'LOWER') return text.toLocaleLowerCase()
  if (textCase === 'TITLE') {
    // The rest of a word the stretch starts inside, marks and all, goes on in lower case.
    const rest = continuesWord ? (WORD_REST.exec(text)?.[0] ?? '') : ''
    return rest.toLocaleLowerCase() + text.slice(rest.length).replace(WORD, capitalized)
  }
  return text
}

/** Whether the character at `index` goes on with a word the characters before it started. */
function continuesWord(text: string, index: number): boolean {
  return index > 0 && WORD_END.test(text.slice(Math.max(0, index - 2), index))
}

/** A stretch of a text shown in one case. */
export interface TextCaseSegment {
  start: number
  end: number
  textCase: TextCase
}

/** The text in stretches of one case each: its runs' own, and the text's between them. */
export function textCaseSegments(node: CasedText): TextCaseSegment[] {
  const segments: TextCaseSegment[] = []
  const add = (start: number, end: number, textCase: TextCase) => {
    if (end <= start) return
    const previous = segments.at(-1)
    if (previous?.end === start && previous.textCase === textCase) previous.end = end
    else segments.push({ start, end, textCase })
  }
  let at = 0
  for (const run of node.styleRuns.toSorted((a, b) => a.start - b.start)) {
    const start = Math.max(at, run.start)
    const end = Math.min(node.text.length, run.start + run.length)
    add(at, start, node.textCase)
    add(start, end, run.style.textCase ?? node.textCase)
    at = Math.max(at, end)
  }
  add(at, node.text.length, node.textCase)
  return segments
}

/** `text[start, end)` as it is shown, in the case each of its characters has. */
export function shownTextSlice(node: CasedText, start: number, end: number): string {
  let shown = ''
  for (const segment of textCaseSegments(node)) {
    const from = Math.max(start, segment.start)
    const to = Math.min(end, segment.end)
    if (to <= from) continue
    shown += transformTextCase(
      node.text.slice(from, to),
      segment.textCase,
      continuesWord(node.text, from)
    )
  }
  return shown
}

/** A text as it is shown, in the case each of its characters has. */
export function shownText(node: CasedText): string {
  if (node.styleRuns.every((run) => run.style.textCase === undefined)) {
    return transformTextCase(node.text, node.textCase)
  }
  return shownTextSlice(node, 0, node.text.length)
}

/**
 * Each character of the shown text with the index of the character of `text` it comes from;
 * a case can give one character several, as `ß` upper-cases to `SS`. Each stretch is cased as
 * a whole, as `shownText` cases it, so a letter that depends on its word, such as a final `ς`,
 * is the one shown.
 */
export function shownCharacters(
  node: CasedText
): Array<{ character: string; sourceIndex: number }> {
  const result: Array<{ character: string; sourceIndex: number }> = []
  for (const segment of textCaseSegments(node)) {
    const slice = node.text.slice(segment.start, segment.end)
    const whole = Array.from(
      transformTextCase(slice, segment.textCase, continuesWord(node.text, segment.start))
    )
    const sources: Array<{ shown: string[]; sourceIndex: number }> = []
    let sourceIndex = segment.start
    for (const sourceCharacter of slice) {
      const shown = transformTextCase(
        sourceCharacter,
        segment.textCase,
        continuesWord(node.text, sourceIndex)
      )
      sources.push({ shown: Array.from(shown), sourceIndex })
      sourceIndex += sourceCharacter.length
    }
    // Where casing the stretch whole shows as many characters as casing each one, each source
    // character takes its own share of the whole; otherwise each keeps its own casing.
    const aligned =
      sources.reduce((count, source) => count + source.shown.length, 0) === whole.length
    let at = 0
    for (const source of sources) {
      for (const character of source.shown) {
        result.push({ character: aligned ? whole[at] : character, sourceIndex: source.sourceIndex })
        at++
      }
    }
  }
  return result
}
