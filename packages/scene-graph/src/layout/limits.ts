import type { GridPosition, GridTrack } from '../types'

/**
 * Bounds for the numbers layout hands to Yoga. Yoga's WASM build aborts the module on a grid
 * span that is not a positive integer, and an abort or an exception thrown through its frames
 * leaves the WASM stack pointer un-restored, so later calls misbehave; absurd values also make
 * layout do unbounded work. Every path that writes a layout value clamps to these bounds, and
 * tool schemas reject values outside them.
 */

/** The largest size or position, in pixels, that a layout value may carry. */
export const MAX_LAYOUT_LENGTH = 1_000_000

/** The largest gap, padding, or stroke a layout value may carry, in pixels. */
export const MAX_LAYOUT_SPACING = 100_000

/** The largest number of tracks one grid template may name. */
export const MAX_GRID_TRACKS = 1_000

/** The last grid line a placement may name; line 0 leaves placement to auto-flow. */
export const MAX_GRID_LINE = 1_000

/** The most tracks one grid item may span. */
export const MAX_GRID_SPAN = 1_000

/** The largest rotation, in degrees, a layout or transform may carry. */
export const MAX_LAYOUT_ANGLE = 360_000

/** The largest font size, in pixels, text may be set in. */
export const MAX_FONT_SIZE = 10_000

/** The largest ratio a layout factor, such as a flex grow share, may carry. */
export const MAX_LAYOUT_FACTOR = 1_000

/** The largest line height or letter spacing, in pixels or percent, a text may carry. */
export const MAX_TEXT_LENGTH = 10_000

/** A length that cannot be negative, such as a size, padding, gap, or radius. */
export function clampLayoutLength(value: number, max = MAX_LAYOUT_LENGTH): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(max, Math.max(0, value))
}

/** A coordinate that may be negative, such as a position. */
export function clampLayoutPosition(value: number, max = MAX_LAYOUT_LENGTH): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(max, Math.max(-max, value))
}

/** A whole grid line, as `column` and `row` carry it; 0 leaves placement to auto-flow. */
export function clampGridLine(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(MAX_GRID_LINE, Math.max(0, Math.trunc(value)))
}

/** A whole number of tracks a grid item spans, which layout requires to be at least 1. */
export function clampGridSpan(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_GRID_SPAN, Math.max(1, Math.trunc(value)))
}

/** A font size in pixels, at least one and at most `MAX_FONT_SIZE`; fractions are kept. */
export function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_FONT_SIZE, Math.max(1, value))
}

/** A grid template's tracks, with at most `MAX_GRID_TRACKS` of them and no negative sizes. */
export function clampGridTracks(tracks: readonly GridTrack[]): GridTrack[] {
  return tracks.slice(0, MAX_GRID_TRACKS).map((track) => ({
    ...track,
    value: clampLayoutLength(track.value)
  }))
}

/** A grid item's placement, clamped to the lines and spans layout can place. */
export function clampGridPosition(position: GridPosition): GridPosition {
  return {
    column: clampGridLine(position.column),
    row: clampGridLine(position.row),
    columnSpan: clampGridSpan(position.columnSpan),
    rowSpan: clampGridSpan(position.rowSpan)
  }
}
