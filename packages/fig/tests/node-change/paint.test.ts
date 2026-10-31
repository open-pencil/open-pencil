import { describe, expect, test } from 'bun:test'

import { convertFills, convertStrokes, fillToKiwiPaint } from '#fig/node-change/paint'

import type { Paint } from '@open-pencil/kiwi/fig/codec'
import type { Fill } from '@open-pencil/scene-graph'

/** Every adjustment Figma's image panel offers, as the archive names them. */
const PAINT_FILTER = {
  exposure: 0.5,
  contrast: -0.25,
  vibrance: 0.75,
  temperature: -0.5,
  tint: 0.125,
  highlights: -0.75,
  shadows: 0.25
}

/** The same adjustments by the plugin API's names. */
const FILTERS = {
  exposure: 0.5,
  contrast: -0.25,
  saturation: 0.75,
  temperature: -0.5,
  tint: 0.125,
  highlights: -0.75,
  shadows: 0.25
}

const IMAGE: Fill = {
  type: 'IMAGE',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  imageHash: 'ab'.repeat(20),
  imageScaleMode: 'FILL'
}

describe("an image paint's adjustments", () => {
  test("read by the plugin API's names, on fills and strokes, and not at all when every one is 0", () => {
    const paint: Paint = { type: 'IMAGE', imageScaleMode: 'FILL', paintFilter: PAINT_FILTER }

    expect(convertFills([paint])[0].filters).toEqual(FILTERS)
    expect(convertStrokes([paint], 2, 'INSIDE')[0].filters).toEqual(FILTERS)
    const unadjusted = { ...paint, paintFilter: { exposure: 0, vibrance: 0 } }
    expect(convertFills([unadjusted])[0].filters).toBeUndefined()
  })

  test('write back as the paint filter, leaving out the ones at 0', () => {
    expect(fillToKiwiPaint({ ...IMAGE, filters: FILTERS }).paintFilter).toEqual(PAINT_FILTER)
    expect(fillToKiwiPaint({ ...IMAGE, filters: { saturation: -1, tint: 0 } }).paintFilter).toEqual(
      { vibrance: -1 }
    )
  })
})
