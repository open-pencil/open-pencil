import { describe, expect, test } from 'bun:test'

import {
  convertEffects,
  convertFills,
  convertStrokes,
  fillToKiwiPaint
} from '#fig/node-change/paint'

import type { Paint } from '@open-pencil/kiwi/fig/codec'
import type { Fill } from '@open-pencil/scene-graph'

/** Every adjustment Figma's image panel offers, as the archive names and scales them. */
const PAINT_FILTER = {
  exposure: 0.5,
  contrast: -0.075,
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

describe('convertEffects', () => {
  test('reads noise and grain effects under the names Figma copies them with', () => {
    // Effects as Figma 126 copied them after the plugin API set a duotone noise of size 1 and
    // density 0.7, a multitone at opacity 0.25, and a texture of size 3 and radius 6.
    const base = {
      offset: { x: 0, y: 0 },
      visible: true,
      blendMode: 'NORMAL',
      spread: 0,
      showShadowBehindNode: true,
      color: { r: 0, g: 0, b: 0, a: 1 }
    }
    const [duotone, multitone, texture] = convertEffects([
      {
        ...base,
        type: 'NOISE',
        radius: 4,
        secondaryColor: { r: 1, g: 0, b: 0, a: 0.5 },
        noiseSize: { x: 1, y: 1 },
        density: 0.699999988079071,
        noiseType: 'DUOTONE'
      },
      {
        ...base,
        type: 'NOISE',
        radius: 4,
        noiseSize: { x: 4, y: 4 },
        density: 1,
        noiseType: 'MULTITONE',
        opacity: 0.25
      },
      { ...base, type: 'GRAIN', radius: 6, noiseSize: { x: 3, y: 3 }, clipToShape: false }
    ])
    expect(duotone).toMatchObject({
      type: 'NOISE',
      noise: {
        noiseType: 'DUOTONE',
        noiseSize: { x: 1, y: 1 },
        density: 0.699999988079071,
        secondaryColor: { r: 1, g: 0, b: 0, a: 0.5 }
      }
    })
    expect(multitone.noise).toEqual({
      noiseType: 'MULTITONE',
      noiseSize: { x: 4, y: 4 },
      density: 1,
      opacity: 0.25
    })
    expect(texture).toMatchObject({
      type: 'TEXTURE',
      radius: 6,
      texture: { noiseSize: { x: 3, y: 3 }, clipToShape: false }
    })
  })

  test('leaves out effect types the scene graph does not model', () => {
    const effects = convertEffects([
      { type: 'REPEAT', visible: true },
      { type: 'DROP_SHADOW', radius: 4, visible: true }
    ])
    expect(effects.map((effect) => effect.type)).toEqual(['DROP_SHADOW'])
  })

  test('hold damaged noise and texture numbers within Figma’s ranges', () => {
    const [noise, texture] = convertEffects([
      {
        type: 'NOISE',
        visible: true,
        noiseType: 'MULTITONE',
        noiseSize: { x: Number.NaN, y: 400 },
        density: Number.NaN,
        opacity: 3,
        seed: Number.POSITIVE_INFINITY
      },
      { type: 'GRAIN', visible: true, radius: 4, noiseSize: { x: -2, y: Number.NaN } }
    ])
    expect(noise.noise).toEqual({
      noiseType: 'MULTITONE',
      noiseSize: { x: 1, y: 100 },
      density: 0,
      opacity: 1
    })
    expect(texture.texture?.noiseSize).toEqual({ x: 0, y: 1 })
  })

  test('a duotone without a second colour draws both tones in its first', () => {
    const red = { r: 1, g: 0, b: 0, a: 1 }
    const [duotone] = convertEffects([
      { type: 'NOISE', visible: true, color: red, noiseType: 'DUOTONE', density: 1 }
    ])
    expect(duotone.noise?.secondaryColor).toEqual(red)
  })
})
