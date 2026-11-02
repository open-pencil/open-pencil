import { describe, expect, test } from 'bun:test'

import { scriptResult } from '#core-tests/helpers/script'

// Expected values were recorded by running the same scripts in Figma.

/** Runs `script` with `colors` and the util functions detached, as Figma's docs alias them. */
function withColors(colors: unknown[], script: string) {
  return scriptResult(`
    const { rgb: toRGB, rgba: toRGBA, solidPaint } = figma.util
    const colors = ${JSON.stringify(colors)}
    const attempt = (call) => { try { call(); return null } catch (error) { return error.message } }
    ${script}
  `)
}

/** `colors` read by `figma.util.rgba`, each channel rounded to the precision Figma's agree to. */
async function rgbaOf(colors: string[]) {
  const result = await withColors(colors, 'return colors.map((color) => toRGBA(color))')
  if (!Array.isArray(result)) return result
  return result.map((color: Record<string, number>) =>
    Object.fromEntries(Object.entries(color).map(([key, value]) => [key, Number(value.toFixed(3))]))
  )
}

describe('figma.util', () => {
  test('rgb reads hex and CSS colors and drops their alpha', async () => {
    const colors = ['#FF00FF', '#f0f8', 'rgb(0 128 255 / 50%)', 'hsl(120 100% 25%)', ' red ']
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
      { r: 1, g: 0, b: 0 },
      { r: 1, g: 0.5, b: 0 }
    ])
  })

  test('rgba keeps the alpha, defaults it to 1, and takes an alpha that overrides it', async () => {
    expect(
      await withColors(
        ['rgb(25% 25% 25% / 0.5)', '#00ff00', { r: 0, g: 0, b: 1 }, 'transparent'],
        "return [...colors.map((color) => toRGBA(color)), toRGBA('#ff000080', 0.25)]"
      )
    ).toEqual([
      { r: 0.25, g: 0.25, b: 0.25, a: 0.5 },
      { r: 0, g: 1, b: 0, a: 1 },
      { r: 0, g: 0, b: 1, a: 1 },
      { r: 0, g: 0, b: 0, a: 0 },
      { r: 1, g: 0, b: 0, a: 0.25 }
    ])
  })

  test('clips colors outside sRGB channel by channel and reads lab() with a D65 white', async () => {
    expect(
      await rgbaOf([
        'color(display-p3 1 0 0)',
        'oklch(70% 0.2 30)',
        'oklab(0.7 0.3 0.1)',
        'lab(50% 40 59 / 0.5)',
        'rgb(300 0 0)',
        'rgb(0 0 0 / 150%)'
      ])
    ).toEqual([
      { r: 1, g: 0, b: 0, a: 1 },
      { r: 1, g: 0.38, b: 0.301, a: 1 },
      { r: 1, g: 0, b: 0.29, a: 1 },
      { r: 0.766, g: 0.34, b: 0.007, a: 0.5 },
      { r: 1, g: 0, b: 0, a: 1 },
      { r: 0, g: 0, b: 0, a: 1 }
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
        return [
          solidPaint('#FF00FF88', existing),
          solidPaint('#FF00FF', { opacity: 0.2, color: { r: 0, g: 1, b: 0 }, boundVariables: {} })
        ]`
      )
    ).toEqual([
      {
        type: 'SOLID',
        color: { r: 1, g: 0, b: 1 },
        opacity: 0x88 / 255,
        visible: false,
        blendMode: 'MULTIPLY'
      },
      { type: 'SOLID', color: { r: 1, g: 0, b: 1 }, opacity: 1, boundVariables: {} }
    ])
  })

  test('a color, alpha, or override it cannot take is refused with Figma’s message', async () => {
    expect(
      await withColors(
        [
          'not a color',
          'lch(50% 70 50)',
          'rgb(none 0 0)',
          'rgb(255 0 0 / none)',
          { r: 255, g: 0, b: 0 },
          { r: 2, g: -1, b: 0 }
        ],
        `return [
          attempt(() => toRGB(colors[0])),
          attempt(() => toRGBA(colors[1])),
          attempt(() => toRGB(colors[2])),
          attempt(() => toRGBA(colors[3])),
          attempt(() => solidPaint(colors[4])),
          attempt(() => toRGB(colors[5])),
          attempt(() => toRGB({ r: 1, g: 0, b: 0, x: 1 })),
          attempt(() => toRGB(5)),
          attempt(() => toRGB(null)),
          attempt(() => toRGB()),
          attempt(() => toRGBA('#fff', 2)),
          attempt(() => toRGBA('#fff', -1)),
          attempt(() => toRGBA('#fff', '0.5')),
          attempt(() => solidPaint('#fff', { type: 'GRADIENT_LINEAR' })),
          attempt(() => solidPaint('#fff', { foo: 1 })),
          attempt(() => solidPaint('#fff', { visible: 'yes' })),
          attempt(() => solidPaint('#fff', { blendMode: 'NOPE' })),
          attempt(() => solidPaint('#fff', null))
        ]`
      )
    ).toEqual([
      'in rgb: failed to parse color: not a color',
      'in rgba: failed to parse color: lch(50% 70 50)',
      'in rgb: failed to parse color: rgb(none 0 0)',
      'in rgba: failed to parse color: rgb(255 0 0 / none)',
      'in solidPaint: Property "color" failed validation: Too big: expected number to be <=1 at .r',
      'in rgb: Property "color" failed validation: Too big: expected number to be <=1 at .r\n' +
        'Too small: expected number to be >=0 at .g',
      'in rgb: Property "color" failed validation: Unrecognized key: "x"',
      'in rgb: Property "color" failed validation: Expected one of the following, but none matched:\n' +
        '  Expected string, received number\n  Expected object, received number',
      'in rgb: Property "color" failed validation: Expected one of the following, but none matched:\n' +
        '  Expected string, received null\n  Expected object, received null',
      'in rgb: Property "color" failed validation: Expected one of the following, but none matched:\n' +
        '  Required value missing',
      'in rgba: Property "alphaOverride" failed validation: Too big: expected number to be <=1',
      'in rgba: Property "alphaOverride" failed validation: Too small: expected number to be >=0',
      'in rgba: Property "alphaOverride" failed validation: Expected number, received string',
      'in solidPaint: Property "SolidPaint" failed validation: Invalid input: expected "SOLID" at .type',
      'in solidPaint: Property "SolidPaint" failed validation: Unrecognized key: "foo"',
      'in solidPaint: Property "SolidPaint" failed validation: Expected boolean, received string at .visible',
      'in solidPaint: Property "SolidPaint" failed validation: Invalid option: expected one of ' +
        '"PASS_THROUGH"|"NORMAL"|"DARKEN"|"MULTIPLY"|"LINEAR_BURN"|"COLOR_BURN"|"LIGHTEN"|"SCREEN"|' +
        '"LINEAR_DODGE"|"COLOR_DODGE"|"OVERLAY"|"SOFT_LIGHT"|"HARD_LIGHT"|"DIFFERENCE"|"EXCLUSION"|' +
        '"HUE"|"SATURATION"|"COLOR"|"LUMINOSITY" at .blendMode',
      'in solidPaint: Property "SolidPaint" failed validation: Expected object, received null'
    ])
  })

  test('normalizeMarkdown, which has no rich-text editor to normalize for, is refused by name', async () => {
    expect(
      await withColors([], "return attempt(() => figma.util.normalizeMarkdown('# Title'))")
    ).toEqual(expect.stringContaining('in normalizeMarkdown: OpenPencil does not support'))
  })
})
