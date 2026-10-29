import { sum } from 'es-toolkit'

import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

/** A layer's box on the page, by its id. */
export interface PlacedBox extends Rect {
  id: string
}

type Axis = 'horizontal' | 'vertical'

/** A spread this small counts as already lined up, as Figma leaves 150 and 151 apart. */
const ALIGNED_SPREAD = 1
/** Gaps that differ by no more than this count as already even. */
const EVEN_GAPS = 2

const KEY = { horizontal: 'x', vertical: 'y' } as const
const startOf = (box: Rect, axis: Axis) => (axis === 'horizontal' ? box.x : box.y)
const sizeOf = (box: Rect, axis: Axis) => (axis === 'horizontal' ? box.width : box.height)

/** Rounds halves up, as Figma places a column between 150 and 153 at 152. */
function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5)
}

/**
 * The boxes in bands along `axis`: columns for `horizontal`, rows for `vertical`. A box joins a
 * band when its middle lies within the band's extent.
 */
function bands(boxes: PlacedBox[], axis: Axis): PlacedBox[][] {
  const middle = (box: Rect) => startOf(box, axis) + sizeOf(box, axis) / 2
  const result: { boxes: PlacedBox[]; min: number; max: number }[] = []
  for (const box of [...boxes].sort((a, b) => middle(a) - middle(b))) {
    const band = result.find(
      (candidate) => middle(box) >= candidate.min && middle(box) <= candidate.max
    )
    const min = startOf(box, axis)
    const max = min + sizeOf(box, axis)
    if (band) {
      band.boxes.push(box)
      band.min = Math.min(band.min, min)
      band.max = Math.max(band.max, max)
    } else {
      result.push({ boxes: [box], min, max })
    }
  }
  return result.map((band) => band.boxes)
}

/**
 * Starts from the first that space things of `sizes` evenly, with the gap the first and last
 * leave, rounded to a whole pixel, so the last may move by under a pixel as in Figma.
 */
function evenStarts(starts: number[], sizes: number[]): number[] {
  const lastIndex = starts.length - 1
  const first = starts[0]
  const last = starts[lastIndex]
  if (lastIndex < 2) return starts
  const gap = roundHalfUp((last - first - sum(sizes.slice(0, lastIndex))) / lastIndex)
  let cursor = first
  return sizes.map((size) => {
    const placed = cursor
    cursor += size + gap
    return placed
  })
}

function gapsEven(starts: number[], sizes: number[]): boolean {
  const gaps = starts
    .slice(1)
    .map((value, index) => value - (starts[index] ?? 0) - (sizes[index] ?? 0))
  return gaps.length < 2 || Math.max(...gaps) - Math.min(...gaps) <= EVEN_GAPS
}

function moveAlong(placed: Map<string, Vector>, box: PlacedBox, axis: Axis, value: number) {
  const at = placed.get(box.id) ?? { x: box.x, y: box.y }
  placed.set(box.id, { ...at, [KEY[axis]]: value })
}

/** One row or column: spaced evenly along it from its first box. */
function spreadLine(boxes: PlacedBox[], axis: Axis, placed: Map<string, Vector>) {
  const line = [...boxes].sort((a, b) => startOf(a, axis) - startOf(b, axis))
  const spaced = evenStarts(
    line.map((box) => startOf(box, axis)),
    line.map((box) => sizeOf(box, axis))
  )
  for (const [index, box] of line.entries()) {
    moveAlong(placed, box, axis, spaced[index] ?? startOf(box, axis))
  }
}

/** Lines each band up at the midrange of its members and evens out the bands' spacing. */
function alignBands(groups: PlacedBox[][], axis: Axis, placed: Map<string, Vector>) {
  const midranges = groups.map((group) => {
    const values = group.map((box) => startOf(box, axis))
    const min = Math.min(...values)
    const max = Math.max(...values)
    return max - min <= ALIGNED_SPREAD ? null : roundHalfUp((min + max) / 2)
  })
  const starts = groups.map((group, index) => midranges[index] ?? startOf(group[0], axis))
  const sizes = groups.map((group) => Math.max(...group.map((box) => sizeOf(box, axis))))
  const respaced = !gapsEven(starts, sizes)
  const targets = respaced ? evenStarts(starts, sizes) : starts
  for (const [index, group] of groups.entries()) {
    const target = targets[index]
    // A band already lined up, with spacing already even, keeps each box where it is.
    if (midranges[index] === null && !respaced) continue
    for (const box of group) moveAlong(placed, box, axis, target)
  }
}

/**
 * Where Figma's Tidy Up puts each box: a single row or column is spaced evenly from its first
 * box with the gap its ends leave, each box keeping its place across; a grid lines each column and
 * row up at the midrange of its members and spaces columns and rows evenly when their gaps
 * differ. Positions are lefts and tops in the boxes' own axes.
 */
export function tidyPositions(boxes: PlacedBox[]): Map<string, Vector> {
  const placed = new Map(boxes.map((box) => [box.id, { x: box.x, y: box.y }]))
  if (boxes.length < 2) return placed
  const rows = bands(boxes, 'vertical')
  const columns = bands(boxes, 'horizontal')
  if (rows.length === 1) spreadLine(boxes, 'horizontal', placed)
  else if (columns.length === 1) spreadLine(boxes, 'vertical', placed)
  else {
    alignBands(columns, 'horizontal', placed)
    alignBands(rows, 'vertical', placed)
  }
  return placed
}

/**
 * Where Figma's Pack Horizontal or Pack Vertical puts each box: edge to edge with no gap, in
 * order of their left (or top) edges, from the first; each keeps its place across.
 */
export function packPositions(boxes: PlacedBox[], axis: Axis): Map<string, Vector> {
  const line = [...boxes].sort((a, b) => startOf(a, axis) - startOf(b, axis))
  const placed = new Map<string, Vector>()
  let cursor = line[0] ? startOf(line[0], axis) : 0
  for (const box of line) {
    placed.set(box.id, { x: box.x, y: box.y, [KEY[axis]]: cursor })
    cursor += sizeOf(box, axis)
  }
  return placed
}
