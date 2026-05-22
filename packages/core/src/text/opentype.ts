import * as OpenTypeSync from 'opentype.js'

import { LRUMap } from '#core/lru-map'

import { fontManager } from './fonts'

export interface OutlineCommand {
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
  advanceWidth?: number
  getPath(x: number, y: number, fontSize: number): OutlinePath
}

interface OutlineFont {
  unitsPerEm: number
  ascender: number
  descender: number
  tables: { os2?: { sTypoLineGap?: number } }
  charToGlyphIndex(char: string): number
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

export const PARSED_FONT_CACHE_LIMIT = 128

const parsedFontCache = new LRUMap<string, OutlineFont>(PARSED_FONT_CACHE_LIMIT)

/** Glyph-level LRU cache keyed by `${family}|${style}|${text}|${fontSize}`.
 *  Eliminates redundant recomputation of identical glyph outlines across
 *  multiple TEXT nodes with the same text content (GAP-004).
 *
 *  IMPORTANT: Returned arrays are shared mutable references. Callers MUST
 *  treat them as read-only — mutation would silently corrupt the cache. */
const glyphOutlineCache = new LRUMap<string, Array<Array<string | number>>>(500)

export function clearOpenTypeCaches(): void {
  parsedFontCache.clear()
  glyphOutlineCache.clear()
}

export function getOpenTypeCacheSizes(): { parsedFont: number; glyphOutline: number } {
  return {
    parsedFont: parsedFontCache.size,
    glyphOutline: glyphOutlineCache.size
  }
}

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

export interface GlyphOutlineMetrics {
  commands: OutlineCommand[]
  x: number
  advance: number
}

export function fontHasGlyphSync(family: string, style: string, char: string): boolean {
  const font = getParsedFont(family, style)
  if (!font) return false
  return font.charToGlyphIndex(char) !== 0
}

export function getGlyphOutlineMetricsSync(
  family: string,
  style: string,
  text: string,
  fontSize: number
): GlyphOutlineMetrics[] | null {
  const font = getParsedFont(family, style)
  if (!font) return null

  const glyphs = font.stringToGlyphs(text)
  let x = 0
  const scale = fontSize / font.unitsPerEm
  return glyphs.map((glyph) => {
    const commands = glyph.getPath(0, 0, fontSize).commands
    const advance = (glyph.advanceWidth ?? 0) * scale
    const metrics = { commands, x, advance }
    x += advance
    return metrics
  })
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
  const cacheKey = `${family}|${style}|${text}|${fontSize}`
  const cached = glyphOutlineCache.get(cacheKey)
  if (cached !== undefined) return cached

  const font = getParsedFont(family, style)
  if (!font) return null

  const glyphs = font.stringToGlyphs(text)
  const result = glyphs.map((glyph) =>
    commandsToFigmaNumbers(glyph.getPath(0, 0, fontSize).commands)
  )

  glyphOutlineCache.set(cacheKey, result)

  return result
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
