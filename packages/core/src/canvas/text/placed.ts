import type { Paragraph } from 'canvaskit-wasm'
import { uniq } from 'es-toolkit/array'

import type { SceneNode } from '@open-pencil/scene-graph'
import { textLengthPixels } from '@open-pencil/scene-graph/text'

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
  type GlyphOutlineSource,
  type ShapedGlyph
} from '#core/text/font/glyphs'
import type { ShapingFeature } from '#core/text/font/harfbuzz'
import { fontManager } from '#core/text/font/manager'
import { textFontFace } from '#core/text/requirements/collect'

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

/** The loaded face of a family the paragraph draws a face in, as its key. */
function loadedStyle(
  family: string,
  weight: number,
  italic: boolean,
  style: string
): string | null {
  return loadedFace(family, weight, italic, style)?.style ?? null
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
  const style = textFontFace(node, run?.style).style
  const variations = drawnFontVariations({
    family,
    weight,
    italic,
    style,
    fontSize: run?.style.fontSize ?? node.fontSize,
    variations: run?.style.fontVariations ?? node.fontVariations,
    opticalSizeFromFontSize: run?.style.opticalSizeFromFontSize ?? node.opticalSizeFromFontSize
  })
  const drawn = loadedFace(family, weight, italic, style) ?? { weight, italic, style }
  return { family, weight, italic, style, variations, drawn, ...shapingOf(node, run) }
}

/** The features and letter spacing a style run is shaped with, as CanvasKit is given them. */
function shapingOf(node: SceneNode, run: SceneNode['styleRuns'][number] | undefined) {
  const features = (run?.style.fontFeatures ?? node.fontFeatures).map((feature) => ({
    tag: feature.tag.toLowerCase(),
    value: feature.enabled ? 1 : 0
  }))
  const fontSize = run?.style.fontSize ?? node.fontSize
  const letterSpacing = textLengthPixels(run?.style.letterSpacing ?? node.letterSpacing, fontSize)
  return { features, letterSpacing }
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
  return loadedStyle(family, font.drawn.weight, font.drawn.italic, font.drawn.style)
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

/** The characters of a run as the paragraph laid them out, and the features it shaped them with. */
interface RunShape {
  text: string
  runText: string
  /** The character each glyph starts at. */
  offsets: number[]
  /** Where the characters a glyph starts at end. */
  nextBoundary: Map<number, number>
  start: number
  end: number
  features: readonly ShapingFeature[]
}

/**
 * Whether the font drew the run. Every glyph of one character being the one the font maps it to
 * says so. A run whose features or ligatures changed glyphs ("12:30", "->", Arabic forms) is the
 * font's when HarfBuzz shapes its characters to the same glyphs in it, as CanvasKit, which
 * shapes with HarfBuzz, shaped them. One matching glyph says nothing: two files of a family, such
 * as a static instance and the variable font, number most glyphs alike.
 */
function drewRun(source: GlyphOutlineSource, run: GlyphRun, shape: RunShape): boolean {
  const mapped = Array.from(run.glyphs).every((glyph, index) => {
    const from = shape.offsets[index]
    const character = shape.text.slice(from, shape.nextBoundary.get(from))
    // A glyph for a ligature or a cluster does not map from one character.
    const codePoint = character.codePointAt(0)
    if (codePoint === undefined || String.fromCodePoint(codePoint) !== character) return false
    // The missing glyph, like whitespace, says nothing about which font drew it.
    return glyph === 0 || /\s/.test(character) || source.glyphOf(character) === glyph
  })
  if (mapped) return true
  const glyphs = source.shape(shape.runText, shape.features)
  return (
    glyphs.length === run.glyphs.length && glyphs.every(({ id }, index) => id === run.glyphs[index])
  )
}

/** Characters a shaper draws as nothing, such as variation selectors and joiners, whatever the font. */
const DRAWN_AS_NOTHING = /[\s\p{Default_Ignorable_Code_Point}]/u

/**
 * The characters a run draws with glyphs of its font, leaving out whitespace and characters the
 * shaper draws as nothing. A character no font has is shaped as the run font's missing glyph
 * (ID 0), which says nothing about which font that is, so it does not count against the font
 * the run's other characters confirm.
 */
function drawnCharacters(run: GlyphRun, shape: RunShape): string {
  const { text, offsets, nextBoundary, start, end } = shape
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
 * The font a run's outlines come from, and the glyphs to save when it shaped them itself:
 * HarfBuzz's, from the run's first character, with the run's letter spacing.
 */
type RunOutline =
  | { source: GlyphOutlineSource; glyphs?: undefined }
  | { source: GlyphOutlineSource; glyphs: ShapedGlyph[]; start: number; letterSpacing: number }

/**
 * The font a run was shaped with. CanvasKit leaves `GlyphRun.typeface` null, so the run's font
 * is found as the paragraph falls back: the first of the fonts it lists, the style's own then
 * its fallbacks, that has every character of the run, confirmed by the glyphs it chose. When no
 * font confirms them their IDs name no outline, so the text keeps its characters in the first
 * font that has them all, shaped by HarfBuzz as the paragraph would shape them in it.
 * The paragraph asks each family for a face it has loaded, so CanvasKit never fakes one.
 */
function runOutline(
  node: SceneNode,
  shaped: string,
  run: GlyphRun,
  characterAt: (offset: number) => number
): RunOutline | null {
  if (run.glyphs.length === 0) return null
  const offsets = Array.from(run.offsets, characterAt)
  const start = Math.min(...offsets)
  const end = Math.max(...offsets)
  // A glyph covers the characters up to the next greater offset in the run, whatever its
  // direction; the sorted offsets give that once for every glyph.
  const boundaries = uniq([...offsets, end]).sort((a, b) => a - b)
  const nextBoundary = new Map(
    boundaries.map((offset, index) => [offset, boundaries[index + 1] ?? end])
  )
  const font = fontAt(node, start)
  const shape: RunShape = {
    text: shaped,
    runText: shaped.slice(start, end),
    offsets,
    nextBoundary,
    start,
    end,
    features: font.features
  }
  const characters = drawnCharacters(run, shape)
  let primary: GlyphOutlineSource | null = null
  for (const source of candidateSources(font)) {
    if (!source.covers(characters)) continue
    if (characters === '' || drewRun(source, run, shape)) return { source }
    primary ??= source
  }
  if (!primary) return null
  return {
    source: primary,
    glyphs: primary.shape(shape.runText, font.features),
    start,
    letterSpacing: font.letterSpacing
  }
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
 * The glyphs HarfBuzz shaped for a run, when they are not as many as CanvasKit's: placed one
 * after another from where the run starts.
 */
function reshapedGlyphs(
  run: GlyphRun,
  outline: Extract<RunOutline, { glyphs: ShapedGlyph[] }>,
  lineLeft: number,
  y: number
): LaidOutGlyph[] {
  let x = run.positions[0]
  return outline.glyphs.map((glyph) => {
    const advance = glyph.advance * run.size + outline.letterSpacing
    const placed: LaidOutGlyph = {
      id: glyph.id,
      x,
      y,
      fontSize: run.size,
      firstCharacter: outline.start + glyph.cluster,
      advance,
      lineLeft,
      source: outline.source
    }
    x += advance
    return placed
  })
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
      const outline: RunOutline | null = ellipsis
        ? { source: ellipsis }
        : runOutline(node, shaped, run, characterAt)
      // Run positions round the baseline to whole pixels; line metrics keep it exact.
      const y = baseline + offsetY
      if (outline?.glyphs && outline.glyphs.length !== run.glyphs.length) {
        glyphs.push(...reshapedGlyphs(run, outline, left, y))
        continue
      }
      for (let index = 0; index < run.glyphs.length; index++) {
        const x = run.positions[index * 2]
        glyphs.push({
          id: outline?.glyphs?.[index].id ?? run.glyphs[index],
          x,
          y,
          fontSize: run.size,
          // The ellipsis truncation adds draws no character, as Figma saves it.
          firstCharacter: ellipsis ? undefined : characterAt(run.offsets[index]),
          advance: run.positions[(index + 1) * 2] - x,
          lineLeft: left,
          source: outline?.source ?? null
        })
      }
    }
  }
  return glyphs
}
