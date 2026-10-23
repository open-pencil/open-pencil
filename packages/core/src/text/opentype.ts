import * as OpenTypeSync from 'opentype.js'

import type { FontVariation } from '@open-pencil/scene-graph'

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
  /**
   * The default instance's advance, which opentype.js sets aside when it draws a variable font's
   * instance and overwrites `advanceWidth` with that instance's.
   */
  _advanceWidth?: number
  getPath(
    x: number,
    y: number,
    fontSize: number,
    options?: { variation?: Record<string, number> },
    font?: OutlineFont
  ): OutlinePath
}

interface OutlineFont {
  unitsPerEm: number
  ascender: number
  descender: number
  tables: {
    os2?: { sTypoLineGap?: number; yStrikeoutPosition?: number; yStrikeoutSize?: number }
    post?: { underlinePosition?: number; underlineThickness?: number }
    fvar?: unknown
  }
  glyphs: { get(index: number): OutlineGlyph | undefined }
  charToGlyphIndex(char: string): number
  charToGlyph(char: string): OutlineGlyph
  forEachGlyph(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    options: undefined,
    callback: (glyph: OutlineGlyph, x: number) => void
  ): number
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

interface ParsedFontCacheEntry {
  bytes: ArrayBuffer
  font: OutlineFont | null
}

const parsedFontCache = new Map<string, ParsedFontCacheEntry>()

function getParsedFont(family: string, style: string): OutlineFont | null {
  const key = `${family}|${style}`
  const bytes = fontManager.loadedData(family, style)
  if (!bytes) return null
  const cached = parsedFontCache.get(key)
  if (cached?.bytes === bytes) return cached.font
  try {
    const font = (OpenTypeSync as OpenTypeModule).parse(bytes.slice(0))
    parsedFontCache.set(key, { bytes, font })
    return font
  } catch {
    parsedFontCache.set(key, { bytes, font: null })
    return null
  }
}

/**
 * True when the font is available AND parseable for glyph-outline extraction —
 * i.e. getGlyphOutlineMetricsSync can produce outlines for it. Availability is
 * currently local (fontManager), but the contract is provider-agnostic so a
 * future remote source can satisfy it. Path-text editing needs this to reflow;
 * without it the text is a baked graphic.
 */
export function hasGlyphOutlines(family: string, style: string): boolean {
  return getParsedFont(family, style) !== null
}

function glyphsForCodePoints(font: OutlineFont, text: string): OutlineGlyph[] {
  return Array.from(text, (character) => font.charToGlyph(character))
}

/** A glyph's advance in the font's default instance, whatever instance was last drawn. */
function glyphAdvanceWidth(font: OutlineFont, glyph: OutlineGlyph, fontSize: number): number {
  return ((glyph._advanceWidth ?? glyph.advanceWidth ?? 0) * fontSize) / font.unitsPerEm
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

  const singleLineWidth = glyphsForCodePoints(font, text).reduce(
    (width, glyph) => width + glyphAdvanceWidth(font, glyph, fontSize),
    0
  )

  if (maxWidth && maxWidth > 0 && singleLineWidth > maxWidth) {
    const lines = Math.ceil(singleLineWidth / maxWidth)
    return { width: maxWidth, height: Math.ceil(lines * lineH) }
  }
  return { width: Math.ceil(singleLineWidth), height: lineH }
}

/**
 * Where a font draws its underline and strikethrough, in ems: each line's top edge below the
 * baseline (negative above it) and its thickness. Figma places an underline's top half its
 * thickness below the font's underline position, and a strikethrough's top at its strikeout
 * position.
 */
export interface FontDecorationMetrics {
  underlineTop: number
  underlineThickness: number
  strikethroughTop: number
  strikethroughThickness: number
}

/** The decoration metrics of a loaded font, or `null` when it is not loaded or lacks them. */
export function fontDecorationMetricsSync(
  family: string,
  style: string
): FontDecorationMetrics | null {
  const font = getParsedFont(family, style)
  const post = font?.tables.post
  const os2 = font?.tables.os2
  if (
    !font ||
    post?.underlinePosition === undefined ||
    !post.underlineThickness ||
    os2?.yStrikeoutPosition === undefined ||
    !os2.yStrikeoutSize
  )
    return null
  const em = font.unitsPerEm
  return {
    underlineTop: (post.underlineThickness / 2 - post.underlinePosition) / em,
    underlineThickness: post.underlineThickness / em,
    strikethroughTop: -os2.yStrikeoutPosition / em,
    strikethroughThickness: os2.yStrikeoutSize / em
  }
}

/** How far a loaded font reaches above and below the baseline, in ems; null when not loaded. */
export function fontVerticalMetricsSync(
  family: string,
  style: string
): { ascent: number; descent: number } | null {
  const font = getParsedFont(family, style)
  if (!font || !(font.unitsPerEm > 0)) return null
  return { ascent: font.ascender / font.unitsPerEm, descent: -font.descender / font.unitsPerEm }
}

export interface GlyphOutlineMetrics {
  commands: OutlineCommand[]
  x: number
  advance: number
}

export type FontGlyphCoverage = 'has' | 'missing' | 'unknown'

export function fontGlyphCoverageSync(
  family: string,
  style: string,
  char: string
): FontGlyphCoverage {
  const bytes = fontManager.loadedData(family, style)
  if (!bytes) return 'unknown'
  const font = getParsedFont(family, style)
  if (!font) return 'unknown'
  return font.charToGlyphIndex(char) !== 0 ? 'has' : 'missing'
}

export function fontHasGlyphSync(family: string, style: string, char: string): boolean {
  return fontGlyphCoverageSync(family, style, char) === 'has'
}

export function getGlyphOutlineMetricsSync(
  family: string,
  style: string,
  text: string,
  fontSize: number
): GlyphOutlineMetrics[] | null {
  const font = getParsedFont(family, style)
  if (!font) return null

  try {
    const positioned: Array<{ glyph: OutlineGlyph; x: number }> = []
    const endX = font.forEachGlyph(text, 0, 0, fontSize, undefined, (glyph, x) => {
      positioned.push({ glyph, x })
    })
    return positioned.map(({ glyph, x }, index) => ({
      commands: glyph.getPath(0, 0, fontSize).commands,
      x,
      // opentype.js applies substitutions, ligatures, GPOS kerning, and default
      // render features in forEachGlyph. Derive each shaped advance from those
      // positions rather than reconstructing it from raw code points.
      advance: (positioned[index + 1]?.x ?? endX) - x
    }))
  } catch {
    // Some fonts use OpenType lookup formats that opentype.js cannot shape yet.
    // Preserve outline editing with the dependency's basic glyph/advance APIs.
    const glyphs = glyphsForCodePoints(font, text)
    let x = 0
    return glyphs.map((glyph) => {
      const commands = glyph.getPath(0, 0, fontSize).commands
      const advance = glyphAdvanceWidth(font, glyph, fontSize)
      const metrics = { commands, x, advance }
      x += advance
      return metrics
    })
  }
}

/** Outlines of one loaded font, addressed by the glyph IDs a shaper produced. */
export interface GlyphOutlineSource {
  /** Whether the font has a glyph for every code point, so a shaper used it rather than a fallback. */
  covers(text: string): boolean
  /** The glyph the font maps `character` to, to check a shaper's glyph IDs are this font's. */
  glyphOf(character: string): number
  outline(glyphId: number, fontSize: number): OutlineCommand[] | null
}

/**
 * Glyph outlines by glyph ID for a loaded font, or `null` when it is not loaded or cannot be
 * parsed. A variable font draws the instance at `variations`, the axis values the shaper used.
 */
export function glyphOutlineSourceSync(
  family: string,
  style: string,
  variations: readonly FontVariation[] = []
): GlyphOutlineSource | null {
  const font = getParsedFont(family, style)
  if (!font) return null
  const variation = font.tables.fvar
    ? { variation: Object.fromEntries(variations.map(({ axis, value }) => [axis, value])) }
    : undefined
  return {
    covers: (text) => Array.from(text).every((char) => font.charToGlyphIndex(char) !== 0),
    glyphOf: (character) => font.charToGlyphIndex(character),
    outline: (glyphId, fontSize) =>
      font.glyphs.get(glyphId)?.getPath(0, 0, fontSize, variation, font).commands ?? null
  }
}

/** The advance of glyph `glyphId` of a loaded font at `fontSize`, or `null` when it has none. */
export function glyphAdvanceSync(
  family: string,
  style: string,
  glyphId: number,
  fontSize: number
): number | null {
  const font = getParsedFont(family, style)
  const glyph = font?.glyphs.get(glyphId)
  return font && glyph ? glyphAdvanceWidth(font, glyph, fontSize) : null
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
  const glyphs = glyphsForCodePoints(font, text)
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
