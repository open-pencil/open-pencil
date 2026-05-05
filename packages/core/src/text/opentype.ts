import * as OpenTypeSync from 'opentype.js'

import { fontManager } from './fonts'

interface OutlineCommand {
  type: string
  x?: number
  y?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
}

interface OutlinePath {
  commands: OutlineCommand[]
}

interface OutlineGlyph {
  path: OutlinePath
  getPath(x: number, y: number, fontSize: number): OutlinePath
}

interface OutlineFont {
  unitsPerEm: number
  ascender: number
  descender: number
  tables: { os2?: { sTypoLineGap?: number } }
  stringToGlyphs(text: string): OutlineGlyph[]
  getAdvanceWidth(text: string, fontSize: number): number
}

export interface GlyphOutlineProbe {
  family: string
  style: string
  unitsPerEm: number
  commandCount: number
  firstGlyphCommandSample: OutlineCommand[]
}

interface OpenTypeModule {
  parse(buffer: ArrayBuffer): OutlineFont
}

const parsedFontCache = new Map<string, OutlineFont>()

function getParsedFont(family: string, style: string): OutlineFont | null {
  const key = `${family}|${style}`
  const cached = parsedFontCache.get(key)
  if (cached) return cached
  const bytes = fontManager.loadedData(family, style)
  if (!bytes) return null
  const font = (OpenTypeSync as OpenTypeModule).parse(bytes.slice(0))
  parsedFontCache.set(key, font)
  return font
}

export function measureTextWithOpenType(
  text: string,
  fontSize: number,
  family: string,
  style: string,
  maxWidth?: number,
  lineHeight?: number
): { width: number; height: number } | null {
  const font = getParsedFont(family, style)
  if (!font) return null

  const scale = fontSize / font.unitsPerEm
  const lineGap = font.tables.os2?.sTypoLineGap ?? 0
  const lineH = lineHeight ?? Math.ceil((font.ascender - font.descender + lineGap) * scale)

  const singleLineWidth = font.getAdvanceWidth(text, fontSize)

  if (maxWidth && maxWidth > 0 && singleLineWidth > maxWidth) {
    const lines = Math.ceil(singleLineWidth / maxWidth)
    return { width: maxWidth, height: Math.ceil(lines * lineH) }
  }
  return { width: Math.ceil(singleLineWidth), height: lineH }
}

function commandsToFigmaNumbers(commands: OutlineCommand[]): Array<string | number> {
  const result: Array<string | number> = []
  for (const command of commands) {
    result.push(command.type)
    if (command.x1 !== undefined) result.push(command.x1)
    if (command.y1 !== undefined) result.push(command.y1)
    if (command.x2 !== undefined) result.push(command.x2)
    if (command.y2 !== undefined) result.push(command.y2)
    if (command.x !== undefined) result.push(command.x)
    if (command.y !== undefined) result.push(command.y)
  }
  return result
}

export function getGlyphOutlineCommandsSync(
  family: string,
  style: string,
  text: string,
  fontSize: number
): Array<Array<string | number>> | null {
  const font = getParsedFont(family, style)
  if (!font) return null

  const glyphs = font.stringToGlyphs(text)
  return glyphs.map((glyph) => commandsToFigmaNumbers(glyph.getPath(0, 0, fontSize).commands))
}

export async function probeGlyphOutlineCommands(
  family: string,
  style: string,
  text: string,
  fontSize: number
): Promise<GlyphOutlineProbe | null> {
  const bytes = fontManager.loadedData(family, style)
  if (!bytes) return null

  const font = (OpenTypeSync as OpenTypeModule).parse(bytes.slice(0))
  const glyphs = font.stringToGlyphs(text)
  const firstGlyph = glyphs.find((glyph: OutlineGlyph) => glyph.path.commands.length > 0)
  const firstGlyphCommandSample = (firstGlyph?.getPath(0, 0, fontSize).commands ?? []).slice(0, 12)

  return {
    family,
    style,
    unitsPerEm: font.unitsPerEm,
    commandCount: firstGlyph?.path.commands.length ?? 0,
    firstGlyphCommandSample
  }
}
