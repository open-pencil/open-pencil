import { mean } from 'es-toolkit'

import { encodePathCommandsBlob } from '@open-pencil/fig/node-change'
import type { DerivedTextGlyph, SceneNode, TextPathData } from '@open-pencil/scene-graph'
import { faceStyleKey } from '@open-pencil/scene-graph/font-style'
import type { Rect } from '@open-pencil/scene-graph/primitives'
import { rangeFontStyle } from '@open-pencil/scene-graph/shared-styles'
import { textLengthPixels } from '@open-pencil/scene-graph/text'

import { getGlyphOutlineMetricsSync } from '#core/text/font/glyphs'
import {
  calibratePathTextLayout,
  getTextPathData,
  layoutPathTextFromAdvances,
  type PathTextLayout,
  sampleTextPath,
  textPathStartDistance
} from '#core/text/path'

/** The fields path text is laid out from; a change to any of them lays it out again. */
const PATH_TEXT_LAYOUT_FIELDS = [
  'text',
  'fontFamily',
  'fontWeight',
  'italic',
  'fontStyle',
  'fontSize',
  'letterSpacing',
  'textAlignHorizontal'
] as const

type PathTextType = Pick<SceneNode, (typeof PATH_TEXT_LAYOUT_FIELDS)[number]>

/**
 * Glyphs for `type` laid out along the path mapped into `box` from the local font: aligned from
 * the text path start, at the calibrated normal offset. Null when the font is unavailable.
 */
function layOutPathText(
  node: SceneNode,
  data: TextPathData,
  box: Rect,
  type: PathTextType,
  layout: PathTextLayout
): DerivedTextGlyph[] | null {
  const { fontSize } = type
  const letterSpacing = textLengthPixels(type.letterSpacing, fontSize)
  const metrics = getGlyphOutlineMetricsSync(
    type.fontFamily,
    faceStyleKey(type),
    type.text,
    fontSize
  )
  if (!metrics) return null
  const run = alignedRun(
    node,
    data,
    box,
    type.textAlignHorizontal,
    layout.anchor,
    metrics,
    letterSpacing
  )
  return layoutPathTextFromAdvances(
    data,
    box,
    run.anchor,
    mean(layout.offsets),
    metrics.slice(0, run.count).map((m) => ({
      commandsBlob: encodePathCommandsBlob(m.commands, fontSize),
      fontSize,
      // Pen walk expects em advances (it multiplies by fontSize); metrics and
      // letterSpacing are px. Folding letterSpacing in here (rather than
      // threading it through layoutPathTextFromAdvances) keeps that function's
      // em-advance contract unchanged for its one caller.
      advance: (m.advance + letterSpacing) / fontSize
    }))
  )
}

/**
 * Re-flow imported path text when its characters or typography change: rebuild glyph
 * outlines from the local font and pen-walk them along the preserved path,
 * keeping the calibrated anchor and mean normal offset. Returns {} whenever
 * the node is not reflowable path text or the font is unavailable — the
 * scene graph then falls back to clearing the baked glyphs (today's
 * plain-text editing behavior).
 */
export function pathTextEditChanges(
  node: SceneNode | undefined,
  changes: Partial<SceneNode>
): Partial<Pick<SceneNode, 'derivedTextGlyphs' | 'strokeGeometry'>> {
  if (node?.type !== 'TEXT') return {}
  if (!PATH_TEXT_LAYOUT_FIELDS.some((field) => changes[field] !== undefined)) return {}
  const text = changes.text ?? node.text
  if (text.trim().length === 0) {
    return node.textPathBox ? { derivedTextGlyphs: null, strokeGeometry: [] } : {}
  }
  if (!node.textPathBox || !node.derivedTextGlyphs?.length) return {}
  const data = getTextPathData(node)
  if (!data) return {}
  const layout = calibratePathTextLayout(node.derivedTextGlyphs, data, node.textPathBox)
  if (!layout) return {}

  // Prefer pending typography from the same update batch over the pre-update
  // node so { text, fontSize/textAlignHorizontal/... } stays consistent for reflow.
  const glyphs = layOutPathText(
    node,
    data,
    node.textPathBox,
    {
      text,
      fontFamily: changes.fontFamily ?? node.fontFamily,
      fontWeight: changes.fontWeight ?? node.fontWeight,
      italic: changes.italic ?? node.italic,
      // A pending face change without a name names no face of the old one.
      fontStyle: rangeFontStyle(node, changes),
      fontSize: changes.fontSize ?? node.fontSize,
      letterSpacing: changes.letterSpacing ?? node.letterSpacing,
      textAlignHorizontal: changes.textAlignHorizontal ?? node.textAlignHorizontal
    },
    layout
  )
  // Baked silhouettes belong to the OLD string — clear them so the renderer
  // rebuilds per-glyph silhouettes for the new lettering.
  return glyphs ? { derivedTextGlyphs: glyphs, strokeGeometry: [] } : {}
}

/**
 * Glyphs for path text whose path now maps into `box`, laid out again from its characters at the
 * same font size, as Figma does, rather than moving the old glyphs, which only fit the old path.
 * `glyphs` and `origBox` are the layer before the resize. Null when the font is unavailable.
 */
export function resizedPathTextGlyphs(
  node: SceneNode,
  glyphs: DerivedTextGlyph[],
  origBox: Rect,
  box: Rect
): DerivedTextGlyph[] | null {
  const data = getTextPathData(node)
  if (!data || node.text.trim().length === 0) return null
  const layout = calibratePathTextLayout(glyphs, data, origBox)
  return layout ? layOutPathText(node, data, box, node, layout) : null
}

/** How far along the path the start of new text moves so it keeps its alignment, px. */
function alignmentShift(align: SceneNode['textAlignHorizontal'], before: number, after: number) {
  if (align === 'CENTER') return (before - after) / 2
  if (align === 'RIGHT') return before - after
  return 0
}

const runWidth = (run: Array<{ advance: number }>, spacing: number) =>
  run.reduce((sum, glyph) => sum + glyph.advance + spacing, 0)

/**
 * The part of the path aligned text may use, in px from the text path start along the direction
 * the text runs. Left-aligned text runs from the start to the path's end, right-aligned text from
 * the path's beginning to the start, and centered text gets the widest span centered on the start.
 * Justified text on an open path gets the whole path; on a closed path, every alignment gets one
 * loop anchored at the start.
 */
function alignmentWindow(
  align: SceneNode['textAlignHorizontal'],
  start: number,
  length: number,
  closed: boolean,
  forward: boolean
): [number, number] {
  if (closed) {
    if (align === 'CENTER') return [-length / 2, length / 2]
    return align === 'RIGHT' ? [-length, 0] : [0, length]
  }
  const ahead = forward ? length - start : start
  const behind = forward ? start : length - start
  if (align === 'CENTER') {
    const half = Math.min(ahead, behind)
    return [-half, half]
  }
  if (align === 'RIGHT') return [-behind, 0]
  if (align === 'JUSTIFIED') return [-behind, ahead]
  return [0, ahead]
}

/** How many leading glyphs fit in `room` px; the first always stays. */
function fittingGlyphCount(run: Array<{ advance: number }>, spacing: number, room: number) {
  let width = 0
  for (const [index, glyph] of run.entries()) {
    width += glyph.advance + spacing
    if (index > 0 && width > room + 1e-6) return index
  }
  return run.length
}

/**
 * Where new text starts on the path, as a fraction of its length, and how many of its glyphs
 * are drawn.
 *
 * Figma lays aligned path text out from the text path start: the point at `tValue` on the
 * segment its network marks (`textPathStartDistance`). Left-aligned text starts there, centered
 * text is centered on it and right-aligned text ends there, in the direction the text runs.
 * Text that doesn't fit the alignment's part of the path (`alignmentWindow`) keeps only the
 * leading glyphs that do, aligned within that part; nothing runs past the ends of an open path
 * or around a closed one twice. A lone glyph wider than its part starts where the part does.
 *
 * Path text without a known start keeps its alignment relative to the old run instead: the
 * shift is the difference between the old and new widths.
 */
function alignedRun(
  node: SceneNode,
  data: TextPathData,
  box: Rect,
  align: SceneNode['textAlignHorizontal'],
  anchor: number,
  metrics: Array<{ advance: number }>,
  letterSpacing: number
): { anchor: number; count: number } {
  const all = { anchor, count: metrics.length }
  const path = sampleTextPath(data, box)
  if (!path || path.length === 0) return all
  const direction = data.forward ? 1 : -1

  const start = data.startSegment === undefined ? null : textPathStartDistance(data, path)
  if (start !== null) {
    const [from, to] = alignmentWindow(align, start, path.length, path.closed, data.forward)
    const count = fittingGlyphCount(metrics, letterSpacing, to - from)
    const width = runWidth(metrics.slice(0, count), letterSpacing)
    let offset = from
    if (width <= to - from) {
      if (align === 'CENTER') offset = (from + to - width) / 2
      else if (align === 'RIGHT') offset = to - width
    }
    return { anchor: (start + direction * offset) / path.length, count }
  }

  if (align !== 'CENTER' && align !== 'RIGHT') return all
  const old = getGlyphOutlineMetricsSync(
    node.fontFamily,
    faceStyleKey(node),
    node.text,
    node.fontSize
  )
  if (!old) return all
  const shift = alignmentShift(
    align,
    runWidth(old, textLengthPixels(node.letterSpacing, node.fontSize)),
    runWidth(metrics, letterSpacing)
  )
  return { anchor: anchor + (direction * shift) / path.length, count: metrics.length }
}
