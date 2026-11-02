import { describe, expect, test } from 'bun:test'

import { packPositions, tidyPositions, type PlacedBox } from '#core/editor/alignment/tidy'
import type { Vector } from '@open-pencil/scene-graph/primitives'

/** 100×70 boxes at the given lefts and tops, as the Figma probes used. */
function boxes(...at: [number, number, number?, number?][]): PlacedBox[] {
  return at.map(([x, y, width = 100, height = 70], index) => ({
    id: String(index),
    x,
    y,
    width,
    height
  }))
}

function positions(placed: Map<string, Vector>): [number, number][] {
  return [...placed.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, at]) => [at.x, at.y])
}

// Expected values are what Figma's Arrange › Tidy Up and Pack did to the same rectangles
// (measured 2026-10-27 in Figma desktop).
describe('tidyPositions', () => {
  test('spaces a single row evenly from its first box, each keeping its own top', () => {
    expect(positions(tidyPositions(boxes([0, 0], [150, 10], [400, -5], [520, 8])))).toEqual([
      [0, 0],
      [173, 10],
      [346, -5],
      [519, 8]
    ])
    expect(positions(tidyPositions(boxes([0, 0], [150, 0], [320, 0])))).toEqual([
      [0, 0],
      [160, 0],
      [320, 0]
    ])
  })

  test('spaces a single column evenly from its first box', () => {
    expect(positions(tidyPositions(boxes([0, 0], [0, 120], [0, 260])))).toEqual([
      [0, 0],
      [0, 130],
      [0, 260]
    ])
  })

  test('lines grid columns and rows up at their midrange, rounding halves up', () => {
    expect(positions(tidyPositions(boxes([10, 0], [150, 0], [0, 120], [150, 120])))).toEqual([
      [5, 0],
      [150, 0],
      [5, 120],
      [150, 120]
    ])
    expect(positions(tidyPositions(boxes([0, 10], [150, 0], [0, 120], [150, 120])))).toEqual([
      [0, 5],
      [150, 5],
      [0, 120],
      [150, 120]
    ])
    expect(positions(tidyPositions(boxes([0, 0], [150, 0], [0, 120], [153, 120])))).toEqual([
      [0, 0],
      [152, 0],
      [0, 120],
      [152, 120]
    ])
    expect(positions(tidyPositions(boxes([0, 0], [160, 0], [0, 120], [150, 120])))).toEqual([
      [0, 0],
      [155, 0],
      [0, 120],
      [155, 120]
    ])
  })

  test('leaves a column a pixel out of line as it is', () => {
    const grid = boxes([0, 0], [150, 0], [0, 120], [151, 120])
    expect(positions(tidyPositions(grid))).toEqual(grid.map((box) => [box.x, box.y]))
  })

  test('spaces grid columns and rows evenly when their gaps differ', () => {
    expect(
      positions(tidyPositions(boxes([0, 0], [150, 0], [320, 0], [0, 120], [150, 120], [320, 120])))
    ).toEqual([
      [0, 0],
      [160, 0],
      [320, 0],
      [0, 120],
      [160, 120],
      [320, 120]
    ])
    expect(
      positions(tidyPositions(boxes([0, 0], [170, 0], [330, 0], [8, 140], [160, 140], [345, 140])))
    ).toEqual([
      [4, 0],
      [171, 0],
      [338, 0],
      [4, 140],
      [171, 140],
      [338, 140]
    ])
    const rows = [0, 120, 250].flatMap((y) => [0, 150, 300].map((x): [number, number] => [x, y]))
    expect(positions(tidyPositions(boxes(...rows))).map(([, y]) => y)).toEqual([
      0, 0, 0, 125, 125, 125, 250, 250, 250
    ])
  })

  test('keeps nearly even spacing and only lines the columns up', () => {
    expect(
      positions(tidyPositions(boxes([0, 0], [140, 0], [282, 0], [2, 120], [143, 120], [279, 120])))
    ).toEqual([
      [1, 0],
      [142, 0],
      [281, 0],
      [1, 120],
      [142, 120],
      [281, 120]
    ])
  })

  test('lines a row up at its midrange in a grid', () => {
    expect(
      positions(
        tidyPositions(boxes([0, 0], [150, 0], [300, 0], [0, 120], [150, 120], [300, 130]))
      ).map(([, y]) => y)
    ).toEqual([0, 0, 0, 125, 125, 125])
  })
})

describe('packPositions', () => {
  test('puts boxes edge to edge in order of their left edges, each keeping its top', () => {
    expect(
      positions(packPositions(boxes([0, 0], [40, 30], [90, 10], [30, 90], [300, 40]), 'horizontal'))
    ).toEqual([
      [0, 0],
      [200, 30],
      [300, 10],
      [100, 90],
      [400, 40]
    ])
  })

  test('stacks boxes top to bottom with no gap, each keeping its left', () => {
    expect(
      positions(packPositions(boxes([0, 0], [10, 150], [-5, 400, 100, 120], [8, 620]), 'vertical'))
    ).toEqual([
      [0, 0],
      [10, 70],
      [-5, 140],
      [8, 260]
    ])
  })
})
