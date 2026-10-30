import type { Paragraph } from 'canvaskit-wasm'
import { uniq } from 'es-toolkit/array'

import type { SceneNode } from '@open-pencil/scene-graph'
import { faceLoadKey } from '@open-pencil/scene-graph/font-style'

import {
  drawnFontVariations,
  loadedFace,
  paragraphSourceFamilies
} from '#core/canvas/text/font-families'
import { laidOutText } from '#core/canvas/text/keycap'
import type { TextLayout, TextLayoutMarker } from '#core/canvas/text/layout'
import { utf16IndicesByUtf8 } from '#core/canvas/text/utf8'
import { DEFAULT_FONT_FAMILY } from '#core/constants'
import { ELLIPSIS } from '#core/text/ellipsis'
import {
  glyphOutlineSourceSync,
  shardCovers,
  type GlyphOutlineSource
} from '#core/text/font/glyphs'
import { fontManager } from '#core/text/font/manager'

type GlyphRun = ReturnType<Paragraph['getShapedLines']>[number]['runs'][number]

/** A glyph of laid-out text where the renderer draws it, with the font its outline comes from. */
export interface LaidOutGlyph {
  /** The glyph ID the shaper chose. */
  id: number
  x: number
  /** The baseline of its line. */
  y: number
  fontSize: number
  /** The character it draws, left out for a list marker. */
  firstCharacter?: number
  advance: number
  /** Where its line starts. */
  lineLeft: number
  /** The font that drew it, or `null` when the shaper may have used another. */
  source: GlyphOutlineSource | null
}

/** The loaded face of a family the paragraph draws a style in, as its style name. */
function loadedStyle(family: string, weight: number, italic: boolean): string | null {
  const face = loadedFace(family, weight, italic)
  return face ? faceLoadKey(face.weight, face.italic) : null
}

/**
 * The font a character asks for: its family, weight, and slant, and the variable axes it sets;
 * and the face the paragraph asks every family for, the one its own family has loaded, as
 * `drawnFontStyle` asks CanvasKit.
 */
function fontAt(node: SceneNode, index: number) {
  const run = node.styleRuns.find((item) => index >= item.start && index < item.start + item.length)
  const family = run?.style.fontFamily ?? (node.fontFamily || DEFAULT_FONT_FAMILY)
  const weight = run?.style.fontWeight ?? node.fontWeight
  const italic = run?.style.italic ?? node.italic
  const style = faceLoadKey(weight, italic)
  const variations = drawnFontVariations({
    family,
    weight,
    italic,
    fontSize: run?.style.fontSize ?? node.fontSize,
    variations: run?.style.fontVariations ?? node.fontVariations,
    opticalSizeFromFontSize: run?.style.opticalSizeFromFontSize ?? node.opticalSizeFromFontSize
  })
  const drawn = loadedFace(family, weight, italic) ?? { weight, italic }
  return { family, weight, italic, style, variations, drawn }
}

/**
 * The style a family of the paragraph is drawn in: the face its own family draws the asked style
 * in, and Regular for the Arabic and CJK fallbacks, as the paragraph asks CanvasKit for them.
 */
function sourceStyle(family: string, font: ReturnType<typeof fontAt>): string | null {
  const scriptFallback =
    family !== font.family &&
    (fontManager.getArabicFallbackFamilies().includes(family) ||
      fontManager.getCJKFallbackFamilies().includes(family))
  if (scriptFallback) return fontManager.isStyleLoaded(family, 'Regular') ? 'Regular' : null
  return loadedStyle(family, font.drawn.weight, font.drawn.italic)
}

/** The outline source of each font the paragraph may have drawn a character in, in its order. */
function* candidateSources(font: ReturnType<typeof fontAt>) {
  for (const family of paragraphSourceFamilies(font.family)) {
    const style = sourceStyle(family, font)
    const source = style ? glyphOutlineSourceSync(family, style, font.variations) : null
    if (source) yield source
  }
}

/** The face and file the paragraph draws a character in. */
export interface CharacterFace {
  family: string
  style: string
  /** Which of the style's files: 0 for its own, then its shards, as `FontManager.shardData` lists them. */
  file: number
  /** Whether it is not the character's own family. */
  fallback: boolean
}

/**
 * The loaded face the paragraph draws the character at `index` of `text` in, as it falls back:
 * of the fonts it lists, the style's own then its fallbacks, each file then its shards, the first
 * that maps the character.
 */
export function characterFace(node: SceneNode, text: string, index: number): CharacterFace | null {
  const codePoint = text.codePointAt(index)
  if (codePoint === undefined) return null
  const character = String.fromCodePoint(codePoint)
  const font = fontAt(node, index)
  for (const family of paragraphSourceFamilies(font.family)) {
    const style = sourceStyle(family, font)
    if (!style) continue
    const fallback = family !== font.family
    if (glyphOutlineSourceSync(family, style, font.variations)?.covers(character))
      return { family, style, file: 0, fallback }
    const shard = fontManager
      .shardData(family, style)
      .findIndex((data) => shardCovers(data, character))
    if (shard !== -1) return { family, style, file: shard + 1, fallback }
  }
  return null
}

/** The family the paragraph draws the character at `index` of `text` in; see {@link characterFace}. */
export function characterFamily(node: SceneNode, text: string, index: number): string | null {
  return characterFace(node, text, index)?.family ?? null
}

/** Whether a glyph the shaper chose is the one the font maps its character to. */
function drawsOwnGlyph(
  source: GlyphOutlineSource,
  run: GlyphRun,
  text: string,
  characterAt: (offset: number) => number
): boolean {
  for (let index = 0; index < run.glyphs.length; index++) {
    const start = characterAt(run.offsets[index])
    const end = characterAt(run.offsets[index + 1])
    // A glyph for one character, not a ligature or a cluster, maps straight from it.
    if (end - start !== 1 || /\s/.test(text[start])) continue
    if (source.glyphOf(text[start]) === run.glyphs[index]) return true
  }
  return false
}

/** Characters a shaper draws as nothing, such as variation selectors and joiners, whatever the font. */
const DRAWN_AS_NOTHING = /[\s\p{Default_Ignorable_Code_Point}]/u

/**
 * The characters a run draws with glyphs of its font, leaving out whitespace and characters the
 * shaper draws as nothing. A character no font has is shaped as the run font's missing glyph
 * (ID 0), which says nothing about which font that is, so it does not count against the font
 * the run's other characters confirm.
 */
function drawnCharacters(
  text: string,
  run: GlyphRun,
  offsets: number[],
  start: number,
  end: number
): string {
  // A glyph covers the characters up to the next greater offset in the run, whatever its
  // direction; the sorted offsets give that once for every glyph.
  const boundaries = uniq([...offsets, end]).sort((a, b) => a - b)
  const nextBoundary = new Map(
    boundaries.map((offset, index) => [offset, boundaries[index + 1] ?? end])
  )
  const missing = new Set<number>()
  for (const [index, glyph] of run.glyphs.entries()) {
    if (glyph !== 0) continue
    const from = offsets[index]
    const to = nextBoundary.get(from) ?? end
    for (let character = from; character < to; character++) missing.add(character)
  }
  let characters = ''
  for (let index = start; index < end;) {
    const codePoint = text.codePointAt(index) ?? 0
    const character = String.fromCodePoint(codePoint)
    if (!missing.has(index) && !DRAWN_AS_NOTHING.test(character)) characters += character
    index += character.length
  }
  return characters
}

/**
 * The font a run was shaped with. CanvasKit leaves `GlyphRun.typeface` null, so the run's font
 * is found as the paragraph falls back: the first of the fonts it lists, the style's own then
 * its fallbacks, that has every character of the run, confirmed by the glyph IDs it chose.
 * The paragraph asks each family for a face it has loaded, so CanvasKit never fakes one.
 */
function runOutlineSource(
  node: SceneNode,
  text: string,
  shaped: string,
  run: GlyphRun,
  characterAt: (offset: number) => number
): GlyphOutlineSource | null {
  if (run.glyphs.length === 0) return null
  const offsets = Array.from(run.offsets, characterAt)
  const start = Math.min(...offsets)
  const end = Math.max(...offsets)
  const characters = drawnCharacters(shaped, run, offsets, start, end)
  for (const source of candidateSources(fontAt(node, start))) {
    if (!source.covers(characters)) continue
    if (characters === '' || drawsOwnGlyph(source, run, text, characterAt)) return source
  }
  return null
}

/**
 * The font of the ellipsis that ends truncated text, when the run is that ellipsis: the
 * paragraph adds it after the last characters shown, from the first font that maps it.
 */
function ellipsisSource(
  node: SceneNode,
  run: GlyphRun,
  characterAt: (offset: number) => number
): GlyphOutlineSource | null {
  if (run.glyphs.length !== 1) return null
  for (const source of candidateSources(fontAt(node, characterAt(run.offsets[0])))) {
    if (source.glyphOf(ELLIPSIS) === run.glyphs[0]) return source
  }
  return null
}

/**
 * A list marker's glyphs as Figma saves them: placed beside their item and drawing no
 * character of the text.
 */
function markerGlyphs(marker: TextLayoutMarker, offsetY: number): LaidOutGlyph[] {
  const source = glyphOutlineSourceSync(marker.face.family, marker.face.style)
  const baseline = marker.paragraph.getLineMetrics().at(0)?.baseline ?? 0
  const glyphs: LaidOutGlyph[] = []
  for (const line of marker.paragraph.getShapedLines()) {
    for (const run of line.runs) {
      for (let index = 0; index < run.glyphs.length; index++) {
        const x = run.positions[index * 2]
        glyphs.push({
          id: run.glyphs[index],
          x: marker.x + x,
          y: marker.y + baseline + offsetY,
          fontSize: run.size,
          advance: run.positions[(index + 1) * 2] - x,
          lineLeft: marker.x,
          source
        })
      }
    }
  }
  return glyphs
}

/**
 * Every glyph of laid-out `text`, `offsetY` below the layout's top, in drawing order: an item's
 * marker before the glyphs of its first line, as Figma saves them. Returns `null` when the
 * layout's lines do not match its shaped lines.
 */
export function laidOutGlyphs(
  node: SceneNode,
  layout: TextLayout,
  text: string,
  offsetY: number
): LaidOutGlyph[] | null {
  const lines = layout.getShapedLines()
  const metrics = layout.getLineMetrics()
  if (lines.length === 0 || lines.length !== metrics.length) return null
  const characterAt = utf16IndicesByUtf8(text)
  // The runs drew the text as laid out, a keycap mark as a zero-width space.
  const shaped = laidOutText(text)
  const markers = new Map(layout.getMarkers().map((marker) => [marker.lineNumber, marker]))
  const glyphs: LaidOutGlyph[] = []
  for (const [lineIndex, line] of lines.entries()) {
    const marker = markers.get(lineIndex)
    if (marker) glyphs.push(...markerGlyphs(marker, offsetY))
    const { left, baseline } = metrics[lineIndex]
    const lastLine = lineIndex === lines.length - 1
    for (const [runIndex, run] of line.runs.entries()) {
      const ellipsis =
        lastLine && runIndex === line.runs.length - 1 && layout.didExceedMaxLines()
          ? ellipsisSource(node, run, characterAt)
          : null
      const source = ellipsis ?? runOutlineSource(node, text, shaped, run, characterAt)
      for (let index = 0; index < run.glyphs.length; index++) {
        const x = run.positions[index * 2]
        glyphs.push({
          id: run.glyphs[index],
          x,
          // Run positions round the baseline to whole pixels; line metrics keep it exact.
          y: baseline + offsetY,
          fontSize: run.size,
          // The ellipsis truncation adds draws no character, as Figma saves it.
          firstCharacter: ellipsis ? undefined : characterAt(run.offsets[index]),
          advance: run.positions[(index + 1) * 2] - x,
          lineLeft: left,
          source
        })
      }
    }
  }
  return glyphs
}
