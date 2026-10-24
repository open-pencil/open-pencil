import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { FIXTURES } from '#core-tests/helpers/paths'

import { withWeightClass } from '#core/text/font/variation'

const font = (name: string) => Bun.file(join(FIXTURES, 'fonts', name)).arrayBuffer()

function weightClass(data: ArrayBuffer): number {
  const view = new DataView(data)
  for (let record = 12; record < 12 + view.getUint16(4) * 16; record += 16) {
    const tag = String.fromCharCode(...new Uint8Array(data, record, 4))
    if (tag === 'OS/2') return view.getUint16(view.getUint32(record + 8) + 4)
  }
  throw new Error('No OS/2 table')
}

describe('withWeightClass', () => {
  test('sets a static font to declare the weight, leaving the loaded bytes as they were', async () => {
    const thin = await font('InterThin-WeightClass250.ttf')
    const drawn = withWeightClass(thin, 100)
    expect(weightClass(drawn)).toBe(100)
    expect(weightClass(thin)).toBe(250)
    expect(drawn.byteLength).toBe(thin.byteLength)
  })

  test('keeps a font that already declares the weight, a variable font, and other files', async () => {
    const thin = await font('InterThin-WeightClass250.ttf')
    const variable = await font('InterVariable-Latin.ttf')
    const notFont = new ArrayBuffer(16)
    expect(withWeightClass(thin, 250)).toBe(thin)
    expect(withWeightClass(variable, 700)).toBe(variable)
    expect(withWeightClass(notFont, 400)).toBe(notFont)
  })
})
