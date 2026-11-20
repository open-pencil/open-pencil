// Figma's equal spacing: the gaps between layers in a row or column that a moving box can match.
import { minBy } from 'es-toolkit'

import { rotatedBBox } from './geometry'
import type { Rect } from './primitives'
import type { SnapGuide } from './snap'
import type { SceneNode } from './types'

/** How close two gaps' lengths must be for equal spacing to show them as one length. */
const EQUAL_GAP_EPSILON = 0.01

/** A box seen along one axis: its extent along it and across it. */
interface Span {
  start: number
  end: number
  crossStart: number
  crossEnd: number
}

interface Gap {
  before: Span
  after: Span
  value: number
}

interface Candidate {
  start: number
  value: number
}

export interface SpacingAxisResult {
  /** How far the box moves along the axis to match the gap. */
  delta: number
  /** Every gap of the matched length, the box's own included, each with `spacing` set. */
  guides: SnapGuide[]
}

export interface SpacingSnapResult {
  x: SpacingAxisResult | null
  y: SpacingAxisResult | null
}

function spanOf(rect: Rect, axis: 'x' | 'y'): Span {
  return axis === 'x'
    ? {
        start: rect.x,
        end: rect.x + rect.width,
        crossStart: rect.y,
        crossEnd: rect.y + rect.height
      }
    : {
        start: rect.y,
        end: rect.y + rect.height,
        crossStart: rect.x,
        crossEnd: rect.x + rect.width
      }
}

function crossesOverlap(a: Span, b: Span): boolean {
  return Math.min(a.crossEnd, b.crossEnd) > Math.max(a.crossStart, b.crossStart)
}

function encloses(outer: Span, inner: Span): boolean {
  return outer.start <= inner.start && outer.end >= inner.end
}

function gapGuide(axis: 'x' | 'y', before: Span, after: Span, from: number, to: number): SnapGuide {
  const cross =
    (Math.max(before.crossStart, after.crossStart) + Math.min(before.crossEnd, after.crossEnd)) / 2
  return { axis, position: cross, from, to, spacing: to - from }
}

/** The layers beside the box along the axis, in order; a box enclosing it, such as its frame, is none. */
function rowOf(moving: Span, targets: Rect[], axis: 'x' | 'y'): Span[] {
  return targets
    .map((rect) => spanOf(rect, axis))
    .filter((span) => crossesOverlap(span, moving) && !encloses(span, moving))
    .toSorted((a, b) => a.start - b.start)
}

/** The gaps between neighbors in the row, skipping one the box sits inside. */
function rowGaps(row: Span[], moving: Span): Gap[] {
  const gaps: Gap[] = []
  for (let i = 1; i < row.length; i++) {
    const before = row[i - 1]
    const after = row[i]
    const value = after.start - before.end
    if (value <= 0) continue
    if (moving.end > before.end && moving.start < after.start) continue
    gaps.push({ before, after, value })
  }
  return gaps
}

/** The nearest layer on each side of the box, within the snapping distance of touching it. */
function neighbors(row: Span[], moving: Span, threshold: number) {
  const center = (moving.start + moving.end) / 2
  let before: Span | undefined
  let after: Span | undefined
  for (const span of row) {
    const spanCenter = (span.start + span.end) / 2
    if (spanCenter < center && span.end <= moving.start + threshold) {
      if (!before || span.end > before.end) before = span
    } else if (spanCenter > center && span.start >= moving.end - threshold) {
      if (!after || span.start < after.start) after = span
    }
  }
  return { before, after }
}

/** Where the box may start: one existing gap from either neighbor, or centered between both. */
function candidates(
  gaps: Gap[],
  size: number,
  before: Span | undefined,
  after: Span | undefined
): Candidate[] {
  const found: Candidate[] = []
  for (const gap of gaps) {
    if (before) found.push({ start: before.end + gap.value, value: gap.value })
    if (after) found.push({ start: after.start - gap.value - size, value: gap.value })
  }
  if (before && after) {
    const value = (after.start - before.end - size) / 2
    found.push({ start: before.end + value, value })
  }
  return found.filter((candidate) => candidate.value > 0)
}

function spacingOnAxis(
  axis: 'x' | 'y',
  movingBounds: Rect,
  targets: Rect[],
  threshold: number
): SpacingAxisResult | null {
  const moving = spanOf(movingBounds, axis)
  const size = moving.end - moving.start
  const row = rowOf(moving, targets, axis)
  if (row.length === 0) return null
  const { before, after } = neighbors(row, moving, threshold)
  const gaps = rowGaps(row, moving)
  const chosen = minBy(
    candidates(gaps, size, before, after).filter(
      (candidate) => Math.abs(candidate.start - moving.start) < threshold
    ),
    (candidate) => Math.abs(candidate.start - moving.start)
  )
  if (!chosen) return null

  const snapped = { ...moving, start: chosen.start, end: chosen.start + size }
  const matches = (value: number) => Math.abs(value - chosen.value) < EQUAL_GAP_EPSILON
  const guides: SnapGuide[] = []
  if (before && matches(snapped.start - before.end))
    guides.push(gapGuide(axis, before, snapped, before.end, snapped.start))
  if (after && matches(after.start - snapped.end))
    guides.push(gapGuide(axis, snapped, after, snapped.end, after.start))
  for (const gap of gaps) {
    if (matches(gap.value))
      guides.push(gapGuide(axis, gap.before, gap.after, gap.before.end, gap.after.start))
  }
  return { delta: chosen.start - moving.start, guides }
}

/**
 * Figma's equal spacing: a box moving along a row or column of layers lands where its gap to the
 * nearest neighbor matches a gap between two others there, or centered between its two
 * neighbors, and every gap of that length is shown with its length. Each axis is independent.
 */
export function computeSpacingSnap(
  movingIds: ReadonlySet<string>,
  movingBounds: Rect,
  allNodes: SceneNode[],
  threshold: number
): SpacingSnapResult {
  const targets = allNodes
    .filter((node) => !movingIds.has(node.id))
    .map((node) => {
      const edges = rotatedBBox(node.x, node.y, node.width, node.height, node.rotation)
      return {
        x: edges.left,
        y: edges.top,
        width: edges.right - edges.left,
        height: edges.bottom - edges.top
      }
    })
  return {
    x: spacingOnAxis('x', movingBounds, targets, threshold),
    y: spacingOnAxis('y', movingBounds, targets, threshold)
  }
}
