import { describe, expect, test } from 'bun:test'

import type { Fill } from '@open-pencil/scene-graph'
import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'

import { textCaretColor } from '#core/canvas/overlays/text-edit'

const solid = (r: number, g: number, b: number, opacity = 1): Fill => ({
  type: 'SOLID',
  color: { r, g, b, a: 1 },
  opacity,
  visible: true
})

function textNode(fills: Fill[], runs: Array<[start: number, length: number, fills: Fill[]]> = []) {
  return createDefaultNode(() => 'caret-text', 'TEXT', {
    text: 'Text',
    fills,
    styleRuns: runs.map(([start, length, runFills]) => ({
      start,
      length,
      style: { fills: runFills }
    }))
  })
}

/** Measured in Figma desktop: the caret takes the text's colour, not the background's. */
describe('text caret colour', () => {
  const red = solid(1, 0, 0)
  const blue = solid(0, 0, 1)
  const runs = textNode(
    [solid(0, 0, 0)],
    [
      [0, 2, [red]],
      [2, 2, [blue]]
    ]
  )

  test("takes the fill of the character before the caret, or the first's at the start", () => {
    expect(textCaretColor(runs, 4)).toEqual(blue.color)
    expect(textCaretColor(runs, 2)).toEqual(red.color)
    expect(textCaretColor(runs, 0)).toEqual(red.color)
  })

  test('keeps the fill opacity', () => {
    expect(textCaretColor(textNode([solid(1, 0, 0, 0.5)]), 4)).toEqual({ r: 1, g: 0, b: 0, a: 0.5 })
  })

  test('is black for a gradient, a hidden fill, several fills, or none', () => {
    const gradient: Fill = { ...red, type: 'GRADIENT_LINEAR' }
    for (const fills of [[gradient], [{ ...red, visible: false }], [red, blue], []]) {
      expect(textCaretColor(textNode(fills), 4)).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    }
  })
})
