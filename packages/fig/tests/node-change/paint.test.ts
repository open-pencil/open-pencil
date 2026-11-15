import { describe, expect, test } from 'bun:test'

import { convertEffects } from '#fig/node-change/paint'

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
})
