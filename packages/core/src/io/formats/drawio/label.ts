import type { CharacterStyleOverride, Fill } from '@open-pencil/scene-graph'
import { tryParseColor } from '@open-pencil/scene-graph/color'

export interface LabelRun {
  start: number
  length: number
  style: CharacterStyleOverride
}

export interface ParsedLabel {
  text: string
  runs: LabelRun[]
}

/** How a stretch of text looks. The cell's own style is the base that tags change. */
export interface RunFormat {
  bold: boolean
  italic: boolean
  underline: boolean
  size: number
  color: string
  family: string
}

/** Tags that end a line of text, so the next text starts on a new one. */
const BLOCK_TAGS = new Set(['div', 'p', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body.startsWith('#')) {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match
    }
    return ENTITIES[body.toLowerCase()] ?? match
  })
}

function attribute(attributes: string, name: string): string | null {
  const match = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attributes)
  return match ? decodeEntities(match.at(1) ?? match.at(2) ?? '') : null
}

function applyTag(format: RunFormat, tag: string, attributes: string): RunFormat {
  const next = { ...format }
  if (tag === 'b' || tag === 'strong') next.bold = true
  if (tag === 'i' || tag === 'em') next.italic = true
  if (tag === 'u') next.underline = true
  if (tag === 'font') {
    next.color = attribute(attributes, 'color') ?? next.color
    next.family = attribute(attributes, 'face') ?? next.family
  }
  const css = attribute(attributes, 'style')
  if (css) {
    const size = /font-size:\s*([\d.]+)px/i.exec(css)
    if (size) next.size = Number.parseFloat(size[1])
    const color = /(?:^|[;\s])color:\s*([^;]+)/i.exec(css)
    if (color) next.color = color[1].trim()
    const weight = /font-weight:\s*(bold|normal|\d+)/i.exec(css)
    if (weight) next.bold = /^bold|^[6-9]00$/i.test(weight[1])
    const fontStyle = /font-style:\s*(italic|normal)/i.exec(css)
    if (fontStyle) next.italic = fontStyle[1].toLowerCase() === 'italic'
    const decoration = /text-decoration[^:;]*:\s*([^;]+)/i.exec(css)
    if (decoration) next.underline = /underline/i.test(decoration[1])
    const family = /font-family:\s*([^;]+)/i.exec(css)
    if (family) next.family = family[1].replace(/["']/g, '').split(',')[0].trim()
  }
  return next
}

function sameFormat(a: RunFormat, b: RunFormat): boolean {
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.size === b.size &&
    a.color === b.color &&
    a.family === b.family
  )
}

function solid(colorText: string): Fill[] | undefined {
  const color = tryParseColor(colorText)
  return color ? [{ type: 'SOLID', color, opacity: 1, visible: true }] : undefined
}

/** What a stretch changes about the text it sits in. */
function runStyle(format: RunFormat, base: RunFormat): CharacterStyleOverride {
  const style: CharacterStyleOverride = {}
  if (format.bold !== base.bold) style.fontWeight = format.bold ? 700 : 400
  if (format.italic !== base.italic) style.italic = format.italic
  if (format.underline !== base.underline) {
    style.textDecoration = format.underline ? 'UNDERLINE' : 'NONE'
  }
  if (format.size !== base.size) style.fontSize = format.size
  if (format.family !== base.family) style.fontFamily = format.family
  if (format.color !== base.color) {
    const fills = solid(format.color)
    if (fills) style.fills = fills
  }
  return style
}

interface Piece {
  start: number
  length: number
  format: RunFormat
}

/** Trims trailing blanks and turns the pieces that differ from the base into style runs. */
function finishLabel(text: string, pieces: Piece[], base: RunFormat): ParsedLabel {
  const cut = text.length - text.replace(/\s+$/, '').length
  const final = cut > 0 ? text.slice(0, text.length - cut) : text
  const runs: LabelRun[] = []
  for (const piece of pieces) {
    const length = Math.min(piece.length, final.length - piece.start)
    if (length <= 0 || sameFormat(piece.format, base)) continue
    runs.push({ start: piece.start, length, style: runStyle(piece.format, base) })
  }
  return { text: final, runs }
}

/**
 * The text of a draw.io label and the styling of its words. A plain label has one line of
 * unstyled text. An HTML label keeps its line breaks and the bold, italic, underline, size,
 * family and colour of each stretch; tags it does not know are dropped.
 */
export function parseLabel(value: string, html: boolean, base: RunFormat): ParsedLabel {
  if (!html) return { text: value.trim(), runs: [] }

  let text = ''
  const pieces: Piece[] = []
  const stack: RunFormat[] = [base]
  const lineBreak = () => {
    if (text.length > 0 && !text.endsWith('\n')) text += '\n'
  }

  const tokens = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>|<!--[\s\S]*?-->|([^<]+|<)/g
  for (const match of value.matchAll(tokens)) {
    const [closing, name, attributes, chunk] = [1, 2, 3, 4].map((i) => match.at(i))
    if (chunk !== undefined) {
      const content = decodeEntities(chunk.replace(/[ \t\r\n]+/g, ' '))
      const trimmed = text.length === 0 || text.endsWith('\n') ? content.replace(/^ /, '') : content
      if (trimmed.length === 0) continue
      const format = stack.at(-1) ?? base
      const last = pieces.at(-1)
      if (last && last.start + last.length === text.length && sameFormat(last.format, format)) {
        last.length += trimmed.length
      } else {
        pieces.push({ start: text.length, length: trimmed.length, format })
      }
      text += trimmed
      continue
    }
    if (!name || attributes === undefined) continue
    const tag = name.toLowerCase()
    if (tag === 'br') {
      text += '\n'
    } else if (closing) {
      if (stack.length > 1) stack.pop()
      if (BLOCK_TAGS.has(tag)) lineBreak()
    } else {
      if (BLOCK_TAGS.has(tag)) lineBreak()
      if (!attributes.endsWith('/')) stack.push(applyTag(stack.at(-1) ?? base, tag, attributes))
    }
  }

  return finishLabel(text, pieces, base)
}
