import { describe, expect, test } from 'bun:test'

import { scriptResult } from '#core-tests/helpers/script'

/** Runs `script` with `colors` and the util functions detached, as Figma's docs alias them. */
function withColors(colors: unknown[], script: string) {
  return scriptResult(`
    const { rgb: toRGB, rgba: toRGBA, solidPaint } = figma.util
    const colors = ${JSON.stringify(colors)}
    const attempt = (call) => { try { call(); return null } catch (error) { return error.message } }
    ${script}
  `)
}

describe('figma.util', () => {
  test('rgb reads hex and CSS colors and drops their alpha', async () => {
    const colors = ['#FF00FF', '#f0f8', 'rgb(0 128 255 / 50%)', 'hsl(120 100% 25%)']
    expect(
      await withColors(
        [...colors, { r: 1, g: 0.5, b: 0, a: 0.2 }],
        'return colors.map((color) => toRGB(color))'
      )
    ).toEqual([
      { r: 1, g: 0, b: 1 },
      { r: 1, g: 0, b: 1 },
      { r: 0, g: 128 / 255, b: 1 },
      { r: 0, g: 0.5, b: 0 },
      { r: 1, g: 0.5, b: 0 }
    ])
  })

  test('rgba keeps the alpha, defaults it to 1, and takes an alpha that overrides it', async () => {
    expect(
      await withColors(
        ['rgb(25% 25% 25% / 0.5)', '#00ff00', { r: 0, g: 0, b: 1 }],
        "return [...colors.map((color) => toRGBA(color)), toRGBA('#ff000080', 0.25)]"
      )
    ).toEqual([
      { r: 0.25, g: 0.25, b: 0.25, a: 0.5 },
      { r: 0, g: 1, b: 0, a: 1 },
      { r: 0, g: 0, b: 1, a: 1 },
      { r: 1, g: 0, b: 0, a: 0.25 }
    ])
  })

  test('solidPaint makes a paint a layer takes, its opacity from the alpha', async () => {
    expect(
      await withColors(
        [],
        `const rect = figma.createRectangle()
        rect.fills = [solidPaint('#FF0000')]
        const [{ type, color: { r, g, b }, opacity }] = rect.fills
        return { paint: solidPaint('#0000ff80'), fill: { type, color: { r, g, b }, opacity } }`
      )
    ).toEqual({
      paint: { type: 'SOLID', color: { r: 0, g: 0, b: 1 }, opacity: 128 / 255 },
      fill: { type: 'SOLID', color: { r: 1, g: 0, b: 0 }, opacity: 1 }
    })
  })

  test("solidPaint keeps an existing paint's other properties and takes the new color and opacity", async () => {
    expect(
      await withColors(
        [],
        `const existing = { type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 0.2, visible: false, blendMode: 'MULTIPLY' }
        return solidPaint('#FF00FF88', existing)`
      )
    ).toEqual({
      type: 'SOLID',
      color: { r: 1, g: 0, b: 1 },
      opacity: 0x88 / 255,
      visible: false,
      blendMode: 'MULTIPLY'
    })
  })

  test('a color or alpha it cannot read is refused, saying what it takes', async () => {
    expect(
      await withColors(
        ['not a color', { r: 255, g: 0, b: 0 }],
        `return [
          attempt(() => toRGB(colors[0])),
          attempt(() => solidPaint(colors[1])),
          attempt(() => toRGBA('#fff', 2))
        ]`
      )
    ).toEqual([
      expect.stringContaining('in rgb: Cannot read "not a color" as a color'),
      expect.stringContaining('in solidPaint: Cannot read {"r":255,"g":0,"b":0} as a color'),
      expect.stringContaining('in rgba: alphaOverride must be a number from 0 to 1')
    ])
  })

  test('normalizeMarkdown, which has no rich-text editor to normalize for, is refused by name', async () => {
    expect(
      await withColors([], "return attempt(() => figma.util.normalizeMarkdown('# Title'))")
    ).toEqual(expect.stringContaining('in normalizeMarkdown: OpenPencil does not support'))
  })
})
