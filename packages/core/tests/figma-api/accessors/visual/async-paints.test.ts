import { describe, expect, test } from 'bun:test'

import { createAPI } from '#core-tests/helpers/figma-api'// Measured with the same scripts in Figma's plugin API (Figma desktop 126).

describe('setFillsAsync and setStrokesAsync', () => {
  test('set the paints and resolve', async () => {
    const rectangle = createAPI().createRectangle()
    const pending = rectangle.setFillsAsync([{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }])
    expect(pending).toBeInstanceOf(Promise)
    expect(await pending).toBeUndefined()
    expect(rectangle.fills).toMatchObject([{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }])
    await rectangle.setStrokesAsync([{ type: 'SOLID', color: { r: 0, g: 1, b: 0 } }])
    expect(rectangle.strokes).toMatchObject([{ type: 'SOLID', color: { r: 0, g: 1, b: 0 } }])
  })

  test('refuse paints before they return, naming the method', () => {
    const rectangle = createAPI().createRectangle()
    expect(() => rectangle.setFillsAsync([{ type: 'NOPE' }] as never)).toThrow(
      'in setFillsAsync: Property "fills" failed validation:'
    )
    expect(() => rectangle.setStrokesAsync([{ type: 'NOPE' }] as never)).toThrow(
      'in setStrokesAsync: Property "strokes" failed validation:'
    )
  })
})
