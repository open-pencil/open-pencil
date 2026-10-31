import type { FontVariation } from '@open-pencil/scene-graph'

import { fontManager } from '#core/text/font/manager'

import {
  fontInstance,
  glyphCommands,
  harfBuzzFont,
  isHarfBuzzLoaded,
  loadHarfBuzz,
  shapeText,
  type HarfBuzzFont,
  type OutlineCommand
} from './harfbuzz'
import { fontTableView } from './variation'

export type { OutlineCommand } from './harfbuzz'

export interface GlyphOutlineProbe {
  family: string
  style: string
  unitsPerEm: number
  commandCount: number
  firstGlyphCommandSample: OutlineCommand[]
}

interface ParsedFontCacheEntry {
  bytes: ArrayBuffer
  font: HarfBuzzFont | null
}

const parsedFontCache = new Map<string, ParsedFontCacheEntry>()

/** Shards of a style, read only to tell which one maps a character. */
const shardFontCache = new WeakMap<ArrayBuffer, HarfBuzzFont | null>()

/** Whether a shard of a style, one of `FontManager.shardData`'s files, maps `character`. */
export function shardCovers(data: ArrayBuffer, character: string): boolean {
  if (!isHarfBuzzLoaded()) return false
  let parsed = shardFontCache.get(data)
  if (parsed === undefined) {
    parsed = harfBuzzFont(data)
    shardFontCache.set(data, parsed)
  }
  return parsed !== null && glyphIndex(parsed, character) !== 0
}

function getParsedFont(family: string, style: string): HarfBuzzFont | null {
  if (!isHarfBuzzLoaded()) return null
  const key = `${family}|${style}`
  const bytes = fontManager.loadedData(family, style)
  if (!bytes) return null
  const cached = parsedFontCache.get(key)
  if (cached?.bytes === bytes) return cached.font
  const font = harfBuzzFont(bytes)
  parsedFontCache.set(key, { bytes, font })
  return font
}

/** The glyph the font maps a character to, 0 (`.notdef`) when it has none. */
export function glyphIndex(parsed: HarfBuzzFont, character: string): number {
  const codePoint = character.codePointAt(0)
  if (codePoint === undefined) return 0
  let glyph = parsed.glyphIds.get(codePoint)
  if (glyph === undefined) {
    glyph = parsed.font.glyph(codePoint) ?? 0
    parsed.glyphIds.set(codePoint, glyph)
  }
  return glyph
}

/** A glyph's advance in the font's default instance, in font units. */
function glyphAdvanceUnits(parsed: HarfBuzzFont, glyphId: number): number {
  let advance = parsed.advances.get(glyphId)
  if (advance === undefined) {
    advance = parsed.font.glyphHAdvance(glyphId)
    parsed.advances.set(glyphId, advance)
  }
  return advance
}

/** A glyph's advance in the font's default instance, at `fontSize`. */
function glyphAdvanceWidth(parsed: HarfBuzzFont, glyphId: number, fontSize: number): number {
  return (glyphAdvanceUnits(parsed, glyphId) * fontSize) / parsed.face.upem
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

interface LineMetrics {
  ascender: number
  descender: number
  lineGap: number
}

const lineMetricsCache = new WeakMap<HarfBuzzFont, LineMetrics>()

/** The line metrics the font's `hhea` and `OS/2` tables declare, in font units, read once. */
function lineMetrics(parsed: HarfBuzzFont): LineMetrics {
  const cached = lineMetricsCache.get(parsed)
  if (cached) return cached
  const hhea = fontTableView(parsed.bytes, 'hhea')
  const os2 = fontTableView(parsed.bytes, 'OS/2')
  const hasHhea = hhea !== null && hhea.byteLength >= 8
  const metrics = {
    ascender: hasHhea ? hhea.getInt16(4) : 0,
    descender: hasHhea ? hhea.getInt16(6) : 0,
    lineGap: os2 && os2.byteLength >= 74 ? os2.getInt16(72) : 0
  }
  lineMetricsCache.set(parsed, metrics)
  return metrics
}

export function measureTextWithFont(
  text: string,
  fontSize: number,
  family: string,
  style: string,
  maxWidth?: number,
  lineHeight?: number
): { width: number; height: number } | null {
  const parsed = getParsedFont(family, style)
  if (!parsed) return null

  const scale = fontSize / parsed.face.upem
  const { ascender, descender, lineGap } = lineMetrics(parsed)
  const lineH = lineHeight ?? Math.ceil((ascender - descender + lineGap) * scale)

  let units = 0
  for (const character of text) units += glyphAdvanceUnits(parsed, glyphIndex(parsed, character))
  const singleLineWidth = units * scale

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
  const parsed = getParsedFont(family, style)
  if (!parsed) return null
  const { MetricsTag } = parsed.hb
  const underlinePosition = parsed.font.getMetricPosition(MetricsTag.UNDERLINE_OFFSET)
  const underlineThickness = parsed.font.getMetricPosition(MetricsTag.UNDERLINE_SIZE)
  const strikeoutPosition = parsed.font.getMetricPosition(MetricsTag.STRIKEOUT_OFFSET)
  const strikeoutSize = parsed.font.getMetricPosition(MetricsTag.STRIKEOUT_SIZE)
  if (
    underlinePosition === undefined ||
    !underlineThickness ||
    strikeoutPosition === undefined ||
    !strikeoutSize
  )
    return null
  const em = parsed.face.upem
  return {
    underlineTop: (underlineThickness / 2 - underlinePosition) / em,
    underlineThickness: underlineThickness / em,
    strikethroughTop: -strikeoutPosition / em,
    strikethroughThickness: strikeoutSize / em
  }
}

/** How far a loaded font reaches above and below the baseline, in ems; null when not loaded. */
export function fontVerticalMetricsSync(
  family: string,
  style: string
): { ascent: number; descent: number } | null {
  const parsed = getParsedFont(family, style)
  if (!parsed) return null
  const { ascender, descender } = lineMetrics(parsed)
  return { ascent: ascender / parsed.face.upem, descent: -descender / parsed.face.upem }
}

/** A shaped glyph: its outline relative to the pen at `x`, where shaping placed it, and its advance. */
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
  const parsed = getParsedFont(family, style)
  if (!parsed) return 'unknown'
  return glyphIndex(parsed, char) !== 0 ? 'has' : 'missing'
}

export function fontHasGlyphSync(family: string, style: string, char: string): boolean {
  return fontGlyphCoverageSync(family, style, char) === 'has'
}

/** Each glyph HarfBuzz shapes `text` into, with its outline, pen position, and advance. */
export function getGlyphOutlineMetricsSync(
  family: string,
  style: string,
  text: string,
  fontSize: number
): GlyphOutlineMetrics[] | null {
  const parsed = getParsedFont(family, style)
  if (!parsed) return null
  const scale = fontSize / parsed.face.upem
  const instance = fontInstance(parsed, [])
  let pen = 0
  return shapeText(parsed, text).map((glyph) => {
    // Shaping moves some glyphs off the pen, such as marks onto their base letter.
    const offsetX = (glyph.xOffset ?? 0) * scale
    // y runs down; subtracting keeps an unmoved glyph's baseline 0 rather than -0.
    const baseline = 0 - (glyph.yOffset ?? 0) * scale
    const metrics = {
      commands: glyphCommands(parsed, instance, glyph.codepoint, fontSize, baseline, offsetX),
      x: pen,
      advance: (glyph.xAdvance ?? 0) * scale
    }
    pen += metrics.advance
    return metrics
  })
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
  const parsed = getParsedFont(family, style)
  if (!parsed) return null
  const instance = fontInstance(parsed, variations)
  return {
    covers: (text) => Array.from(text).every((char) => glyphIndex(parsed, char) !== 0),
    glyphOf: (character) => glyphIndex(parsed, character),
    outline: (glyphId, fontSize) =>
      glyphId < parsed.glyphCount ? glyphCommands(parsed, instance, glyphId, fontSize) : null
  }
}

/** The advance of glyph `glyphId` of a loaded font at `fontSize`, or `null` when it has none. */
export function glyphAdvanceSync(
  family: string,
  style: string,
  glyphId: number,
  fontSize: number
): number | null {
  const parsed = getParsedFont(family, style)
  if (!parsed || glyphId >= parsed.glyphCount) return null
  return glyphAdvanceWidth(parsed, glyphId, fontSize)
}

export async function probeGlyphOutlineCommands(
  family: string,
  style: string,
  text: string,
  fontSize: number
): Promise<GlyphOutlineProbe | null> {
  const bytes = fontManager.loadedData(family, style)
  if (!bytes) return null
  await loadHarfBuzz()
  const parsed = harfBuzzFont(bytes)
  if (!parsed) return null
  const outlines = Array.from(text, (character) =>
    glyphCommands(parsed, fontInstance(parsed, []), glyphIndex(parsed, character), fontSize)
  )
  const first = outlines.find((commands) => commands.length > 0) ?? []

  return {
    family,
    style,
    unitsPerEm: parsed.face.upem,
    commandCount: first.length,
    firstGlyphCommandSample: first.slice(0, 12)
  }
}
