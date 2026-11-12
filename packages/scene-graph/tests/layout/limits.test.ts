import { describe, expect, test } from 'bun:test'

import {
  clampFontSize,
  clampGridLine,
  clampGridPosition,
  clampGridSpan,
  clampGridTracks,
  clampLayoutLength,
  clampLayoutPosition,
  MAX_FONT_SIZE,
  MAX_GRID_LINE,
  MAX_GRID_SPAN,
  MAX_GRID_TRACKS,
  MAX_LAYOUT_LENGTH,
  MAX_LAYOUT_SPACING
} from '@open-pencil/scene-graph/layout'

describe('clampLayoutLength', () => {
  test('keeps a length inside its bounds and drops a non-finite one', () => {
    expect(clampLayoutLength(40)).toBe(40)
    expect(clampLayoutLength(-40)).toBe(0)
    expect(clampLayoutLength(MAX_LAYOUT_LENGTH + 1)).toBe(MAX_LAYOUT_LENGTH)
    expect(clampLayoutLength(Number.POSITIVE_INFINITY)).toBe(0)
    expect(clampLayoutLength(Number.NaN)).toBe(0)
    expect(clampLayoutLength(40, MAX_LAYOUT_SPACING)).toBe(40)
    expect(clampLayoutLength(MAX_LAYOUT_SPACING + 1, MAX_LAYOUT_SPACING)).toBe(MAX_LAYOUT_SPACING)
  })
})

describe('clampLayoutPosition', () => {
  test('keeps a signed coordinate inside its bounds', () => {
    expect(clampLayoutPosition(-40)).toBe(-40)
    expect(clampLayoutPosition(MAX_LAYOUT_LENGTH + 1)).toBe(MAX_LAYOUT_LENGTH)
    expect(clampLayoutPosition(-MAX_LAYOUT_LENGTH - 1)).toBe(-MAX_LAYOUT_LENGTH)
    expect(clampLayoutPosition(Number.POSITIVE_INFINITY)).toBe(0)
    expect(clampLayoutPosition(Number.NEGATIVE_INFINITY)).toBe(0)
    expect(clampLayoutPosition(Number.NaN)).toBe(0)
  })

  test('bounds a coordinate by the largest absolute value a caller allows', () => {
    expect(clampLayoutPosition(MAX_LAYOUT_SPACING + 1, MAX_LAYOUT_SPACING)).toBe(MAX_LAYOUT_SPACING)
    expect(clampLayoutPosition(-MAX_LAYOUT_SPACING - 1, MAX_LAYOUT_SPACING)).toBe(
      -MAX_LAYOUT_SPACING
    )
  })
})

describe('clampGridLine', () => {
  test('names a whole line from zero, never past the last one', () => {
    expect(clampGridLine(0)).toBe(0)
    expect(clampGridLine(2.7)).toBe(2)
    expect(clampGridLine(-2)).toBe(0)
    expect(clampGridLine(MAX_GRID_LINE + 1)).toBe(MAX_GRID_LINE)
    expect(clampGridLine(Number.NaN)).toBe(0)
  })
})

describe('clampGridSpan', () => {
  test('spans at least one whole track, never past the bound', () => {
    expect(clampGridSpan(1)).toBe(1)
    expect(clampGridSpan(3.9)).toBe(3)
    expect(clampGridSpan(0)).toBe(1)
    expect(clampGridSpan(-2)).toBe(1)
    expect(clampGridSpan(MAX_GRID_SPAN + 1)).toBe(MAX_GRID_SPAN)
    expect(clampGridSpan(Number.NaN)).toBe(1)
  })
})

describe('clampGridPosition', () => {
  test('clamps every field of a placement', () => {
    expect(clampGridPosition({ column: -1, row: 2.7, columnSpan: 0, rowSpan: 4 })).toEqual({
      column: 0,
      row: 2,
      columnSpan: 1,
      rowSpan: 4
    })
    expect(
      clampGridPosition({
        column: MAX_GRID_LINE + 1,
        row: 0,
        columnSpan: MAX_GRID_SPAN + 1,
        rowSpan: 1
      })
    ).toEqual({ column: MAX_GRID_LINE, row: 0, columnSpan: MAX_GRID_SPAN, rowSpan: 1 })
  })
})

describe('clampGridTracks', () => {
  test('keeps at most the tracks layout can place, without a negative size', () => {
    const tracks = Array.from({ length: MAX_GRID_TRACKS + 5 }, () => ({
      sizing: 'FIXED' as const,
      value: -1
    }))
    const clamped = clampGridTracks(tracks)
    expect(clamped).toHaveLength(MAX_GRID_TRACKS)
    expect(clamped[0]).toEqual({ sizing: 'FIXED', value: 0 })
  })
})

describe('clampFontSize', () => {
  test('sets text at least one pixel and no more than the bound', () => {
    expect(clampFontSize(14)).toBe(14)
    expect(clampFontSize(0.5)).toBe(1)
    expect(clampFontSize(MAX_FONT_SIZE + 1)).toBe(MAX_FONT_SIZE)
    expect(clampFontSize(Number.NaN)).toBe(1)
  })
})
