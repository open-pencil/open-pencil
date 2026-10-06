import type { CanvasKit, Paragraph, TypefaceFontProvider } from 'canvaskit-wasm'

import {
  EMPTY_EXPORT_RUNTIME,
  type FigNodeChangeExportRuntime,
  type ShapedText,
  type ShapedTextGlyph
} from '@open-pencil/fig/node-change'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { buildParagraph, textVerticalOffset } from '#core/canvas/text'
import { getCanvasKit } from '#core/canvaskit'
import { transformTextCase } from '#core/text/case'
import { fontManager, weightToStyle } from '#core/text/fonts'
import { glyphOutlineSourceSync, type GlyphOutlineSource } from '#core/text/opentype'

type GlyphRun = ReturnType<Paragraph['getShapedLines']>[number]['runs'][number]

function fontStyleAt(node: SceneNode, index: number): { family: string; style: string } {
  const run = node.styleRuns.find((item) => index >= item.start && index < item.start + item.length)
  return {
    family: run?.style.fontFamily ?? node.fontFamily,
    style: weightToStyle(run?.style.fontWeight ?? node.fontWeight, run?.style.italic ?? node.italic)
  }
}

/**
 * The font a run was shaped with. CanvasKit leaves `GlyphRun.typeface` null, so the run's
 * glyph IDs are trusted only when the style's own font covers every character of the run and
 * so the paragraph had no reason to fall back to another font.
 */
function runOutlineSource(node: SceneNode, text: string, run: GlyphRun): GlyphOutlineSource | null {
  if (run.fakeBold || run.fakeItalic || run.glyphs.length === 0) return null
  const offsets = Array.from(run.offsets)
  const start = Math.min(...offsets)
  const end = Math.max(...offsets)
  const { family, style } = fontStyleAt(node, start)
  const source = glyphOutlineSourceSync(family, style)
  const characters = text.slice(start, end).replace(/\s/g, '')
  return source?.covers(characters) ? source : null
}

function hasDecoration(node: SceneNode): boolean {
  return (
    node.textDecoration !== 'NONE' ||
    node.styleRuns.some((run) => run.style.textDecoration && run.style.textDecoration !== 'NONE')
  )
}

/**
 * Whether saved glyphs could stand for this text: truncation and case changes that alter its
 * length move glyphs off the characters they came from, and path text is placed along its path.
 */
function canShape(node: SceneNode, text: string): boolean {
  return (
    node.text.length > 0 &&
    node.textTruncation !== 'ENDING' &&
    text.length === node.text.length &&
    !node.textPathData
  )
}

function shapedRunGlyphs(
  run: GlyphRun,
  source: GlyphOutlineSource | null,
  line: { left: number; baseline: number },
  characterOffsets: Array<number | undefined>
): ShapedTextGlyph[] {
  const glyphs: ShapedTextGlyph[] = []
  for (let index = 0; index < run.glyphs.length; index++) {
    const commands = source?.outline(run.glyphs[index], run.size) ?? null
    const x = run.positions[index * 2]
    const nextX = run.positions[(index + 1) * 2]
    const firstCharacter = run.offsets[index]
    glyphs.push({
      commands,
      x,
      // Run positions round the baseline to whole pixels; line metrics keep it exact.
      y: line.baseline,
      fontSize: run.size,
      firstCharacter,
      advance: nextX - x
    })
    characterOffsets[firstCharacter] ??= x - line.left
  }
  return glyphs
}

/** Characters inside a glyph cluster or without a glyph take the offset of the one before. */
function completeCharacterOffsets(offsets: Array<number | undefined>): number[] {
  let previous = 0
  return offsets.map((offset) => {
    previous = offset ?? previous
    return previous
  })
}

/**
 * Lay a text node out as the renderer draws it and pair each shaped glyph with the outline of
 * the glyph ID CanvasKit chose, so ligatures and contextual forms keep their shapes. When a run's
 * font is missing, variable, or a fallback, or the glyphs could not draw the text's decorations,
 * no glyph gets an outline: the layout still stands, and readers draw the text themselves.
 * Returns `null` for text saved glyphs cannot represent at all.
 */
export function shapeText(
  ck: CanvasKit,
  fontProvider: TypefaceFontProvider,
  node: SceneNode
): ShapedText | null {
  const text = transformTextCase(node.text, node.textCase)
  if (!canShape(node, text)) return null

  const paragraph = buildParagraph({ ck, fontProvider, fontsLoaded: true }, node, undefined, {
    halfLeading: true
  })
  try {
    const lines = paragraph.getShapedLines()
    const metrics = paragraph.getLineMetrics()
    if (lines.length === 0 || lines.length !== metrics.length) return null

    const offsetY = textVerticalOffset(node, paragraph.getHeight())
    const glyphs: ShapedTextGlyph[] = []
    const characterOffsets: Array<number | undefined> = Array.from({ length: text.length })
    for (const [lineIndex, line] of lines.entries()) {
      for (const run of line.runs) {
        glyphs.push(
          ...shapedRunGlyphs(
            run,
            runOutlineSource(node, text, run),
            { left: metrics[lineIndex].left, baseline: metrics[lineIndex].baseline + offsetY },
            characterOffsets
          )
        )
      }
    }
    // Outlines from some runs only would draw the text with characters missing, and saved
    // glyphs draw decorations on one baseline.
    const outlined =
      glyphs.every((glyph) => glyph.commands) && !(lines.length > 1 && hasDecoration(node))
    return {
      glyphs: outlined ? glyphs : glyphs.map((glyph) => ({ ...glyph, commands: null })),
      baselines: metrics.map((line) => ({
        firstCharacter: line.startIndex,
        endCharacter: Math.min(line.endIncludingNewline, text.length),
        position: { x: line.left, y: line.baseline + offsetY },
        width: line.width,
        lineY: line.baseline - line.ascent + offsetY,
        lineHeight: line.height,
        lineAscent: line.ascent
      })),
      logicalIndexToCharacterOffsetMap: completeCharacterOffsets(characterOffsets)
    }
  } finally {
    paragraph.delete()
  }
}

function needsShaping(graph: SceneGraph): boolean {
  for (const node of graph.nodes.values()) {
    if (node.type === 'TEXT' && node.text && !node.derivedTextGlyphs?.length) return true
  }
  return false
}

/**
 * Run a `.fig` or Figma clipboard write with text shaping. Unless the attached font provider
 * belongs to this CanvasKit, the loaded fonts are registered in one that lives for this write only.
 */
export async function withFigExportRuntime<T>(
  graph: SceneGraph,
  ck: CanvasKit | undefined,
  write: (runtime: FigNodeChangeExportRuntime) => Promise<T>
): Promise<T> {
  if (!needsShaping(graph)) return write(EMPTY_EXPORT_RUNTIME)
  const canvasKit = ck ?? (await getCanvasKit())
  const reusable = fontManager.providerFor(canvasKit)
  const provider = reusable ?? canvasKit.TypefaceFontProvider.Make()
  if (!reusable) fontManager.attachProvider(canvasKit, provider)
  try {
    return await write({ shapeText: (node) => shapeText(canvasKit, provider, node) })
  } finally {
    if (!reusable) {
      fontManager.detachProvider(provider)
      provider.delete()
    }
  }
}
