import type { StyleRun } from '@open-pencil/scene-graph'
import {
  hasParagraphSpacing,
  hasTextList,
  paragraphSpacingAt,
  paragraphStyleAt,
  textListItems,
  textParagraphRanges,
  lineStepPixels,
  topLevelNumberDigits,
  type TextParagraphRange
} from '@open-pencil/scene-graph/text'
import { resolveNodeTextDirection } from '@open-pencil/scene-graph/text/direction'

import { TextLayout } from '#core/canvas/text/layout'
import {
  paragraphBlock,
  type BlockBuild,
  type JoinedBlock,
  type SplitBlock,
  type TextLayoutBlock
} from '#core/canvas/text/layout/block'
import type { LineFitting } from '#core/canvas/text/layout/fit'
import {
  firstBuild,
  likelyWraps,
  lineFitting,
  shownToSourceIndex,
  textJoiners
} from '#core/canvas/text/layout/joining'
import type { LineSpacing } from '#core/canvas/text/layout/letter-spacing'
import type { LineHeightRun, TextLayoutBlockLines } from '#core/canvas/text/layout/lines'
import { buildMarker, listInset, listStyle } from '#core/canvas/text/layout/list'
import type { LineCapHeight } from '#core/canvas/text/layout/vertical'
import type { ParagraphBuildOptions } from '#core/canvas/text/paint'
import {
  buildSkParagraph,
  buildTruncateOpts,
  resolveParagraphLayoutWidth,
  type ParagraphBlockOptions
} from '#core/canvas/text/paragraph'
import type { ParagraphNode } from '#core/canvas/text/paragraph/inputs'
import { JoinerIndex, sliceJoiners, type Joiner } from '#core/canvas/text/paragraph/joiners'
import type { TextRenderer } from '#core/canvas/text/renderer'
import { autoWidthWrapWidth } from '#core/layout/text-measurement'
import { shownText } from '#core/text/case'
import { rangeCapHeight } from '#core/text/character-face'
import { utf8Length } from '#core/text/utf8'

/** The placeholder a first-line indent puts before the text takes one UTF-16 unit, three bytes. */
const PLACEHOLDER_UTF8_LENGTH = 3
// Each native paragraph costs a fixed native layout; measured, blocks pay off past 200 joiners.
const BLOCKS_PAST_JOINED_PARAGRAPHS = 200
const JOINED_PARAGRAPHS_PER_BLOCK = 128
const CARRIAGE_RETURN = '\r'

/** Style runs of `text[start, end)` in the slice's own indices. */
function sliceStyleRuns(runs: readonly StyleRun[], start: number, end: number): StyleRun[] {
  const sliced: StyleRun[] = []
  for (const run of runs) {
    const from = Math.max(start, run.start)
    const to = Math.min(end, run.start + run.length)
    if (to > from) sliced.push({ start: from - start, length: to - from, style: run.style })
  }
  return sliced
}

/** Line heights by paragraph index, `lead` places before the text: each run's, the text's elsewhere. */
function lineHeightRuns(node: ParagraphNode, lead: number): LineHeightRun[] {
  // A percent line height follows the font size of the characters it spaces; one of zero, or a
  // percent one under half a pixel, steps lines by none, as Figma does.
  const own = (fontSize = node.fontSize) => lineStepPixels(node.lineHeight, fontSize)
  const runs: LineHeightRun[] = []
  const add = (start: number, end: number, lineHeight: number | null) => {
    const last = runs.at(-1)
    // Runs at one line height measure as one, whatever else they style.
    if (last?.end === start && last.lineHeight === lineHeight) last.end = end
    else runs.push({ start, end, lineHeight })
  }
  let position = 0
  for (const run of node.styleRuns) {
    if (position < run.start) add(position + lead, run.start + lead, own())
    const runSize = run.style.fontSize ?? node.fontSize
    const lineHeight =
      run.style.lineHeight !== undefined
        ? lineStepPixels(run.style.lineHeight, runSize)
        : own(runSize)
    add(run.start + lead, run.start + run.length + lead, lineHeight)
    position = run.start + run.length
  }
  if (position < node.text.length) add(position + lead, node.text.length + lead, own())
  return runs
}

/**
 * What placing a paragraph's lines as Figma does needs: its line heights, and its lines laid
 * out one by one from `node`'s text, the first after its indent and the last truncated as the
 * paragraph is.
 */
function paragraphLines(
  r: TextRenderer,
  node: ParagraphNode,
  color: Float32Array | undefined,
  options: ParagraphBuildOptions,
  {
    firstLineIndent = 0,
    joiners = [],
    index = JoinerIndex.EMPTY
  }: { firstLineIndent?: number; joiners?: readonly Joiner[]; index?: JoinerIndex } = {}
): TextLayoutBlockLines | undefined {
  // Lines are cut by character index, which the text's case must keep.
  if (shownText(node).length !== node.text.length) return undefined
  const lead = firstLineIndent > 0 ? 1 : 0
  const textAt = (at: number) => Math.max(0, index.textOffset(at - lead))
  const ellipsis = buildTruncateOpts(node).ellipsis
  // A justified line is stretched only with text after it: lines are laid out with the rest
  // of the paragraph and cut, as truncated last lines are.
  const justified = node.textAlignHorizontal === 'JUSTIFIED'
  const lineTruncation = (lines: number, truncated: boolean) => {
    if (truncated) return { maxLines: lines, ellipsis }
    return justified ? { maxLines: lines } : {}
  }
  const atParagraph = (at: number) => lead + index.paragraphOffset(at - lead)
  const runs = lineHeightRuns(node, lead)
  return {
    heights:
      index.count === 0
        ? runs
        : runs.map((run) => ({ ...run, start: atParagraph(run.start), end: atParagraph(run.end) })),
    build: (start, end, lines, truncated) => {
      const from = textAt(start)
      const to = justified ? node.text.length : textAt(end)
      const line: ParagraphNode = {
        ...node,
        text: node.text.slice(from, to),
        styleRuns: sliceStyleRuns(node.styleRuns, from, to)
      }
      return buildSkParagraph(r, line, color, options, {
        firstLineIndent: start === 0 ? firstLineIndent : 0,
        truncation: lineTruncation(lines, truncated),
        joiners: sliceJoiners(joiners, from, to)
      })
    }
  }
}

function joinsInBlocksOnceJoined(node: ParagraphNode, joiners: readonly Joiner[]): boolean {
  return (
    joiners.length > BLOCKS_PAST_JOINED_PARAGRAPHS &&
    node.styleRuns.length === 0 &&
    node.textTruncation !== 'ENDING'
  )
}

function joinsInBlocks(
  node: ParagraphNode,
  spacing: LineSpacing,
  joiners: readonly Joiner[]
): boolean {
  return joinsInBlocksOnceJoined(node, joiners) && likelyWraps(node, spacing, joiners)
}

/** Whether the text lays out paragraph by paragraph rather than as one native paragraph. */
function needsParagraphLayout(node: ParagraphNode): boolean {
  return (
    hasTextList(node) ||
    node.paragraphSpacing !== 0 ||
    node.paragraphIndent !== 0 ||
    node.textParagraphs.some(hasParagraphSpacing)
  )
}

function layoutForNode(layout: TextLayout, node: ParagraphNode): void {
  if (node.textAutoResize === 'WIDTH_AND_HEIGHT') {
    layoutAutoWidth(layout, node)
  } else {
    layout.layout(resolveParagraphLayoutWidth(node))
  }
}

function truncatesAtMaxWidth(node: ParagraphNode): boolean {
  return node.textTruncation === 'ENDING' && autoWidthWrapWidth(node) !== undefined
}

function layoutAutoWidth(layout: TextLayout, node: ParagraphNode): void {
  const wrapWidth = resolveParagraphLayoutWidth(node)
  if (truncatesAtMaxWidth(node)) {
    const measuredBoxWidth = node.width || wrapWidth
    layout.layout(Math.min(measuredBoxWidth, wrapWidth))
    return
  }
  layout.layout(wrapWidth)
  const widestLine = Math.ceil(layout.getLongestLine())
  const width = Math.min(wrapWidth, Math.max(node.width || 1, widestLine))
  if (width !== wrapWidth) {
    layout.layout(width)
  }
}

/**
 * Text laid out as several native paragraphs: one per paragraph for lists, paragraph spacing,
 * or a first-line indent, since Skia has no hanging indent; groups of paragraphs for a long
 * joined text, since Skia's joiners cost more the more of them one paragraph holds.
 */
function buildBlocks(
  r: TextRenderer,
  node: ParagraphNode,
  color: Float32Array | undefined,
  options: ParagraphBuildOptions,
  paragraphsPerBlock = 1
): TextLayout {
  const fitting = lineFitting(node)
  const blocks = buildBlockList(r, node, color, options, { fitting, paragraphsPerBlock })
  const maxLines = buildTruncateOpts(node).maxLines
  return new TextLayout(r.ck, blocks, maxLines, trimmedCapHeight(node), fitting)
}

interface BlockListOptions {
  fitting: LineFitting
  paragraphsPerBlock: number
  joined?: boolean
}

function buildBlockList(
  r: TextRenderer,
  node: ParagraphNode,
  color: Float32Array | undefined,
  options: ParagraphBuildOptions,
  { fitting, paragraphsPerBlock, joined = false }: BlockListOptions
): TextLayoutBlock[] {
  const shown = shownText(node)
  const sources = textParagraphRanges(node.text)
  const groups = paragraphGroups(node.text, sources, paragraphsPerBlock)
  const blockSources = groups.map((group) => spannedRange(sources, group))
  const shownParagraphs = textParagraphRanges(shown)
  const shownRanges = groups.map((group) => spannedRange(shownParagraphs, group))
  const items = new Map(
    textListItems(node.text, node.textParagraphs).map((item) => [item.paragraph, item])
  )
  const digits = topLevelNumberDigits([...items.values()])
  const rtl = resolveNodeTextDirection(node) === 'RTL'
  const groupDirection =
    paragraphsPerBlock > 1 ? resolveNodeTextDirection(node) : node.textDirection
  const truncation = buildTruncateOpts(node)
  const maxLines = truncation.maxLines
  // Each paragraph starts one byte, its newline, after the one before it ends.
  const utf8Starts: number[] = []
  let utf8Offset = 0
  for (const range of shownRanges) {
    utf8Starts.push(utf8Offset)
    utf8Offset += utf8Length(shown.slice(range.start, range.end)) + 1
  }

  const firstBlockBuild = (
    joiners: readonly Joiner[],
    plain: () => JoinedBlock,
    join: () => JoinedBlock
  ): BlockBuild => (joined ? join() : firstBuild(node, fitting.spacing, joiners, plain, join))

  const blocks: TextLayoutBlock[] = []
  try {
    for (const [order, { start, end }] of blockSources.entries()) {
      blocks.push(buildBlock(order, groups[order].first, start, end))
    }
  } catch (error) {
    // Native paragraphs built before the failure are not garbage collected.
    for (const block of blocks) {
      block.paragraph.delete()
      block.marker?.paragraph.delete()
    }
    throw error
  }
  return blocks

  function buildBlock(order: number, index: number, start: number, end: number): TextLayoutBlock {
    const shownRange: TextParagraphRange = shownRanges[order]
    const item = items.get(index)
    const paragraphStyle = paragraphStyleAt(node.textParagraphs, index)
    const empty = end === start
    const blockNode: ParagraphNode = {
      ...node,
      text: empty ? ' ' : node.text.slice(start, end),
      styleRuns: empty
        ? sliceStyleRuns(node.styleRuns, start, start + 1)
        : sliceStyleRuns(node.styleRuns, start, end),
      textDirection: groupDirection
    }
    const paragraphIndent = paragraphSpacingAt(node, index, 'paragraphIndent')
    const firstLineIndent =
      paragraphStyle.listType === 'NONE' && paragraphIndent > 0 ? paragraphIndent : 0
    const joiners = empty ? [] : textJoiners(node, fitting, start, end)
    const blockOptions = (
      lines: number | undefined,
      joined: readonly Joiner[]
    ): ParagraphBlockOptions => ({
      firstLineIndent,
      truncation: lines === undefined ? {} : { maxLines: lines, ellipsis: truncation.ellipsis },
      joiners: joined
    })
    const build = (lines: number | undefined, joined: readonly Joiner[] = []) =>
      buildSkParagraph(r, blockNode, color, options, blockOptions(lines, joined))
    const join = (lines = maxLines): JoinedBlock => {
      const joinerIndex = JoinerIndex.of(blockNode.text, joiners)
      return {
        paragraph: build(lines, joiners),
        rebuild: maxLines === undefined ? undefined : (capped) => build(capped, joiners),
        joiners: joinerIndex,
        lines: paragraphLines(r, blockNode, color, options, {
          firstLineIndent,
          joiners,
          index: joinerIndex
        })
      }
    }
    const plain = (): JoinedBlock => ({
      paragraph: build(maxLines),
      rebuild: maxLines === undefined ? undefined : (lines) => build(lines),
      joiners: JoinerIndex.EMPTY,
      lines: paragraphLines(r, blockNode, color, options, { firstLineIndent })
    })
    const betweenItems =
      index > 0 &&
      paragraphStyleAt(node.textParagraphs, index - 1).listType !== 'NONE' &&
      paragraphStyle.listType !== 'NONE'
    const list = item ? listStyle(node, sources[item.groupStart].start) : null
    const marker = item && list ? buildMarker(r, node, item, list, color, options) : null
    let built: BlockBuild
    try {
      built = firstBlockBuild(joiners, plain, join)
    } catch (error) {
      marker?.paragraph.delete()
      throw error
    }
    return {
      ...built,
      start: shownRange.start,
      utf8Start: utf8Starts[order],
      length: shownRange.end - shownRange.start,
      lead: firstLineIndent > 0 ? 1 : 0,
      utf8Lead: firstLineIndent > 0 ? PLACEHOLDER_UTF8_LENGTH : 0,
      leadWidth: firstLineIndent,
      tailShifts: new Map(),
      empty,
      endsAtSeam: paragraphsPerBlock > 1 && order < groups.length - 1,
      inset: item && list ? listInset(node, item, list, digits) : 0,
      rtl,
      // The space after a paragraph is its own: the paragraph before sets the space before.
      spaceBefore:
        index === 0
          ? 0
          : paragraphSpacingAt(node, index - 1, betweenItems ? 'listSpacing' : 'paragraphSpacing'),
      marker,
      x: 0,
      y: 0,
      visible: true,
      metrics: []
    }
  }
}

interface ParagraphGroup {
  first: number
  last: number
}

function spannedRange(
  ranges: readonly TextParagraphRange[],
  { first, last }: ParagraphGroup
): TextParagraphRange {
  return { start: ranges[first].start, end: ranges[last].end }
}

/**
 * Paragraphs `size` at a time, a group ending only in a paragraph with text and no carriage
 * return: a native paragraph ending in an empty line or a `\r` moves that line's box and caret.
 */
function paragraphGroups(
  text: string,
  ranges: readonly TextParagraphRange[],
  size: number
): ParagraphGroup[] {
  if (size === 1) {
    return ranges.map((_, index) => ({ first: index, last: index }))
  }
  const endsGroup = (range: TextParagraphRange) =>
    range.end > range.start && text[range.end - 1] !== CARRIAGE_RETURN
  const groups: ParagraphGroup[] = []
  let first = 0
  for (const [index, range] of ranges.entries()) {
    const next = ranges.at(index + 1)
    const full = index + 1 - first >= size
    if (!next || (full && endsGroup(range))) {
      groups.push({ first, last: index })
      first = index + 1
    }
  }
  return groups
}

function createTextLayout(
  r: TextRenderer,
  node: ParagraphNode,
  color: Float32Array | undefined,
  options: ParagraphBuildOptions
): TextLayout {
  if (needsParagraphLayout(node)) {
    return buildBlocks(r, node, color, options)
  }
  const fitting = lineFitting(node)
  const joiners = textJoiners(node, fitting, 0, node.text.length)
  if (joinsInBlocks(node, fitting.spacing, joiners)) {
    return buildBlocks(r, node, color, options, JOINED_PARAGRAPHS_PER_BLOCK)
  }
  const join = (): JoinedBlock => {
    const index = JoinerIndex.of(node.text, joiners)
    return {
      paragraph: buildSkParagraph(r, node, color, options, { joiners }),
      joiners: index,
      lines: paragraphLines(r, node, color, options, { joiners, index })
    }
  }
  const joinLater = (): JoinedBlock | SplitBlock =>
    joinsInBlocksOnceJoined(node, joiners)
      ? {
          blocks: buildBlockList(r, node, color, options, {
            fitting,
            paragraphsPerBlock: JOINED_PARAGRAPHS_PER_BLOCK,
            joined: true
          })
        }
      : join()
  const plain = (): JoinedBlock => ({
    paragraph: buildSkParagraph(r, node, color, options),
    joiners: JoinerIndex.EMPTY,
    lines: paragraphLines(r, node, color, options)
  })
  const block = paragraphBlock(
    shownText(node).length,
    firstBuild(node, fitting.spacing, joiners, plain, join, joinLater)
  )
  return new TextLayout(r.ck, [block], undefined, trimmedCapHeight(node), fitting)
}

function trimmedCapHeight(node: ParagraphNode): LineCapHeight | undefined {
  if (node.leadingTrim !== 'CAP_HEIGHT') {
    return undefined
  }
  const sourceIndex = shownToSourceIndex(node)
  return (start, end) => {
    const sourceStart = sourceIndex(start)
    const sourceEnd = end > start ? sourceIndex(end - 1) + 1 : sourceStart
    return rangeCapHeight(node, sourceStart, sourceEnd)
  }
}

/** How many laid-out line boxes fit the fixed height, preserving the first line. */
function linesWithinHeight(layout: TextLayout, node: ParagraphNode): number {
  const lines = layout.getLineMetrics()
  const trimmed = node.leadingTrim === 'CAP_HEIGHT'
  const firstOverflow = lines.findIndex(
    (line) => line.baseline + (trimmed ? 0 : line.descent) > node.height
  )
  return Math.max(1, firstOverflow === -1 ? lines.length : firstOverflow)
}

/** Lay a text node out as the renderer draws it, at its own width. */
export function buildParagraph(
  r: TextRenderer,
  node: ParagraphNode,
  color?: Float32Array,
  options: ParagraphBuildOptions = {}
): TextLayout {
  const layout = createTextLayout(r, node, color, options)
  const heightTruncation =
    node.textTruncation === 'ENDING' &&
    node.height > 0 &&
    (node.maxLines == null || node.maxLines <= 0)
  let fittingLines: number | undefined
  try {
    layoutForNode(layout, node)
    if (heightTruncation) {
      fittingLines = linesWithinHeight(layout, node)
    }
  } catch (error) {
    layout.delete()
    throw error
  }
  if (fittingLines !== undefined && fittingLines < layout.getLineMetrics().length) {
    layout.delete()
    return buildParagraph(r, { ...node, maxLines: fittingLines }, color, options)
  }
  return layout
}
