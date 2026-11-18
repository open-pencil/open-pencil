import { describe, expect, test } from 'bun:test'

import {
  clampFontSize,
  clampGridTracks,
  clampLayoutLength,
  clampLayoutPosition,
  MAX_FONT_SIZE,
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
