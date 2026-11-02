import type { Paragraph } from 'canvaskit-wasm'
import { uniq } from 'es-toolkit/array'
import { isEqual } from 'es-toolkit/predicate'

import type { SceneNode } from '@open-pencil/scene-graph'
import { textLengthPixels } from '@open-pencil/scene-graph/text'
import { resolveNodeTextDirection } from '@open-pencil/scene-graph/text/direction'

import type { TextLayout, TextLayoutMarker } from '#core/canvas/text/layout'
import { shownCharacters } from '#core/text/case'
import { candidateSources, fontAt, styleRunAt, type StyleRun } from '#core/text/character-face'
import { ELLIPSIS } from '#core/text/ellipsis'
import {
  glyphOutlineSourceSync,
  type GlyphOutlineSource,
  type RunShaping,
  type ShapedGlyph
} from '#core/text/font/glyphs'
import type { ShapingFeature } from '#core/text/font/harfbuzz'
import { laidOutText } from '#core/text/keycap'
import { utf16IndicesByUtf8 } from '#core/text/utf8'

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

/**
 * The style run of each code unit of the shown text from `start` to `end`, scanning the node's
 * style runs only where one ends.
 */
function styleRunsOver(
  node: SceneNode,
  start: number,
  end: number,
  sourceAt: (index: number) => number
): Array<StyleRun | undefined> {
  const runs: Array<StyleRun | undefined> = []
  let current: StyleRun | undefined
  for (let index = start; index < end; index++) {
    const source = sourceAt(index)
    if (!current || source < current.start || source >= current.start + current.length)
      current = styleRunAt(node, source)
    runs.push(current)
  }
  return runs
}

/** The letter spacing a style run sets after each of its characters, in pixels. */
function letterSpacingOf(node: SceneNode, run: StyleRun | undefined): number {
  return textLengthPixels(
    run?.style.letterSpacing ?? node.letterSpacing,
    run?.style.fontSize ?? node.fontSize
  )
}

/** The features a style run shapes its characters with, as CanvasKit is given them. */
function featuresOf(node: SceneNode, run: StyleRun | undefined): ShapingFeature[] {
  return (run?.style.fontFeatures ?? node.fontFeatures).map((feature) => ({
    tag: feature.tag.toLowerCase(),
    value: feature.enabled ? 1 : 0
  }))
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
  /** How the paragraph shaped the run, worked out when HarfBuzz shapes it. */
  shaping: () => RunShaping
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
  const glyphs = source.shape(shape.runText, shape.shaping())
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
 * HarfBuzz's, from the run's first character, with the letter spacing of each code unit's style.
 */
type RunOutline =
  | { source: GlyphOutlineSource; glyphs?: undefined }
  | { source: GlyphOutlineSource; glyphs: ShapedGlyph[]; start: number; letterSpacing: number[] }

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
  characterAt: (offset: number) => number,
  sourceAt: (index: number) => number
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
  const font = fontAt(node, sourceAt(start))
  let styles: Array<StyleRun | undefined> | undefined
  const stylesOver = () => (styles ??= styleRunsOver(node, start, end, sourceAt))
  let shaping: RunShaping | undefined
  const shape: RunShape = {
    text: shaped,
    runText: shaped.slice(start, end),
    offsets,
    nextBoundary,
    start,
    end,
    shaping: () => (shaping ??= runShaping(node, run, offsets, stylesOver()))
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
    glyphs: primary.shape(shape.runText, shape.shaping()),
    start,
    letterSpacing: stylesOver().map((style) => letterSpacingOf(node, style))
  }
}

/**
 * How the paragraph shaped a run: with the features of each style run in it, as CanvasKit gives
 * them for blocks it shapes as one run; in the direction its glyphs, in visual order, show by
 * their characters, the paragraph's for one glyph; and in its style's language.
 */
function runShaping(
  node: SceneNode,
  run: GlyphRun,
  offsets: readonly number[],
  styles: ReadonlyArray<StyleRun | undefined>
): RunShaping {
  const glyphCount = run.glyphs.length
  const ranges: Array<{ start: number; features: ShapingFeature[] }> = []
  for (const [index, style] of styles.entries()) {
    if (index > 0 && style === styles[index - 1]) continue
    const features = featuresOf(node, style)
    if (!isEqual(ranges.at(-1)?.features, features)) ranges.push({ start: index, features })
  }
  const features =
    ranges.length === 1
      ? ranges[0].features
      : ranges.flatMap((range, index) =>
          range.features.map((feature) => ({
            ...feature,
            start: range.start,
            end: ranges.at(index + 1)?.start ?? styles.length
          }))
        )
  const rtl =
    glyphCount > 1 && offsets[0] !== offsets[glyphCount - 1]
      ? offsets[0] > offsets[glyphCount - 1]
      : resolveNodeTextDirection(node) === 'RTL'
  const style = styles.at(0)?.style
  const language =
    (style?.textLanguage !== undefined ? style.textLanguage : node.textLanguage) ?? undefined
  return { features, rtl, language }
}

/**
 * The font of the ellipsis that ends truncated text, when the run is that ellipsis: the
 * paragraph adds it after the last characters shown, from the first font that maps it.
 */
function ellipsisSource(
  node: SceneNode,
  run: GlyphRun,
  characterAt: (offset: number) => number,
  sourceAt: (index: number) => number
): GlyphOutlineSource | null {
  if (run.glyphs.length !== 1) return null
  for (const source of candidateSources(fontAt(node, sourceAt(characterAt(run.offsets[0]))))) {
    if (source.glyphOf(ELLIPSIS) === run.glyphs[0]) return source
  }
  return null
}

/**
 * The outline of a run of a line, and whether the run is the ellipsis that ends truncated text.
 * The last run of truncated text that no font confirms may be an ellipsis, which keeps its glyph
 * unoutlined: shaping it again would save the characters its offsets point at instead.
 */
function lineRunOutline(
  node: SceneNode,
  shaped: string,
  run: GlyphRun,
  endsTruncated: boolean,
  indices: { characterAt: (offset: number) => number; sourceAt: (index: number) => number }
): { outline: RunOutline | null; ellipsis: boolean } {
  const { characterAt, sourceAt } = indices
  const ellipsis = endsTruncated ? ellipsisSource(node, run, characterAt, sourceAt) : null
  if (ellipsis) return { outline: { source: ellipsis }, ellipsis: true }
  const outline = runOutline(node, shaped, run, characterAt, sourceAt)
  return { outline: endsTruncated && outline?.glyphs ? null : outline, ellipsis: false }
}

/**
 * The character of the node's own text each character of the shown `text` comes from, which
 * its style run is found by: a case can show one character as several, as `ß` upper-cases to
 * `SS`.
 */
function sourceIndices(node: SceneNode, text: string): (index: number) => number {
  if (text === node.text) return (index) => index
  const indices: number[] = []
  for (const { character, sourceIndex } of shownCharacters(node)) {
    indices.push(...Array.from({ length: character.length }, () => sourceIndex))
  }
  return (index) => indices.at(index) ?? index
}

/** Whether HarfBuzz shaped the run to glyphs of the same characters as CanvasKit's. */
function sameClusters(
  run: GlyphRun,
  outline: Extract<RunOutline, { glyphs: ShapedGlyph[] }>,
  characterAt: (offset: number) => number
): boolean {
  return (
    outline.glyphs.length === run.glyphs.length &&
    outline.glyphs.every(
      (glyph, index) => outline.start + glyph.cluster === characterAt(run.offsets[index])
    )
  )
}

/**
 * The glyphs HarfBuzz shaped for a run, when they are not as many as CanvasKit's or stand for
 * other characters: placed one after another from where the run starts.
 */
function reshapedGlyphs(
  run: GlyphRun,
  outline: Extract<RunOutline, { glyphs: ShapedGlyph[] }>,
  lineLeft: number,
  y: number
): LaidOutGlyph[] {
  let x = run.positions[0]
  return outline.glyphs.map((glyph, index) => {
    // Spacing follows a character once, after its last glyph, so marks stay on their base.
    const endsCharacter = outline.glyphs.at(index + 1)?.cluster !== glyph.cluster
    const spacing = endsCharacter ? (outline.letterSpacing.at(glyph.cluster) ?? 0) : 0
    const advance = glyph.advance * run.size + spacing
    const placed: LaidOutGlyph = {
      id: glyph.id,
      x: x + glyph.xOffset * run.size,
      y: y - glyph.yOffset * run.size,
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
  const sourceAt = sourceIndices(node, text)
  const markers = new Map(layout.getMarkers().map((marker) => [marker.lineNumber, marker]))
  const glyphs: LaidOutGlyph[] = []
  for (const [lineIndex, line] of lines.entries()) {
    const marker = markers.get(lineIndex)
    if (marker) glyphs.push(...markerGlyphs(marker, offsetY))
    const { left, baseline } = metrics[lineIndex]
    const lastLine = lineIndex === lines.length - 1
    for (const [runIndex, run] of line.runs.entries()) {
      const endsTruncated =
        lastLine && runIndex === line.runs.length - 1 && layout.didExceedMaxLines()
      const { outline, ellipsis } = lineRunOutline(node, shaped, run, endsTruncated, {
        characterAt,
        sourceAt
      })
      // Run positions round the baseline to whole pixels; line metrics keep it exact.
      const y = baseline + offsetY
      if (outline?.glyphs && !sameClusters(run, outline, characterAt)) {
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
