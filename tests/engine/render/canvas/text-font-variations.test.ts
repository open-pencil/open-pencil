import { describe, expect, test } from 'bun:test'

import { textFontVariations } from '#core/canvas/text'

describe('canvas text font variations', () => {
  test('passes imported variable font axes to CanvasKit text styles', () => {
    expect(
      textFontVariations([
        { axis: 'wght', value: 650 },
        { axis: 'wdth', value: 88 }
      ])
    ).toEqual([
      { axis: 'wght', value: 650 },
      { axis: 'wdth', value: 88 }
    ])
  })

  test('omits font variations when no axes are set', () => {
    expect(textFontVariations([])).toBeUndefined()
    expect(textFontVariations(undefined)).toBeUndefined()
  })
})
