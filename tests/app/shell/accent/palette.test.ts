import { describe, expect, test } from 'bun:test'

import { SELECTION_COLOR } from '@open-pencil/core/constants'
import { contrastRatio, parseColor, rgbaToOkHCL } from '@open-pencil/scene-graph/color'

import {
  ACCENT_LIGHTNESS_RANGE,
  ACCENT_PRESETS,
  accentBaseColor,
  deriveAccentPalette,
  type AccentTheme
} from '@/app/shell/accent/palette'

const THEMES: AccentTheme[] = ['dark', 'light']

function palette(color: string, theme: AccentTheme) {
  return deriveAccentPalette(accentBaseColor({ kind: 'custom', color }), theme)
}

describe('deriveAccentPalette', () => {
  test('the default blue reproduces the interface tokens and canvas selection of the stylesheet', () => {
    const blue = accentBaseColor({ kind: 'preset', preset: 'blue' })
    expect(deriveAccentPalette(blue, 'dark').tokens).toEqual({
      '--color-accent': '#2563EB',
      '--color-panel-focus': '#3B82F6',
      '--color-panel-selected': '#2F6FDD',
      '--color-panel-selected-muted': '#353B46',
      '--color-primary': '#60A5FA',
      '--color-on-accent': '#FFFFFF',
      '--color-on-primary': '#1F2328'
    })
    expect(deriveAccentPalette(blue, 'light').tokens).toEqual({
      '--color-accent': '#2563EB',
      '--color-panel-focus': '#2563EB',
      '--color-panel-selected': '#2563EB',
      '--color-panel-selected-muted': '#E5E7EB',
      '--color-primary': '#1D4ED8',
      '--color-on-accent': '#FFFFFF',
      '--color-on-primary': '#FFFFFF'
    })
    const selection = deriveAccentPalette(blue, 'dark').selection
    expect(selection.color.r).toBeCloseTo(SELECTION_COLOR.r, 2)
    expect(selection.color.g).toBeCloseTo(SELECTION_COLOR.g, 2)
    expect(selection.color.b).toBeCloseTo(SELECTION_COLOR.b, 2)
    expect(selection.foreground).toEqual(parseColor('#FFFFFF'))
  })

  test('every preset keeps white text readable on its accent surfaces in both themes', () => {
    for (const preset of ACCENT_PRESETS) {
      for (const theme of THEMES) {
        const { tokens } = deriveAccentPalette(accentBaseColor({ kind: 'preset', preset }), theme)
        expect(tokens['--color-on-accent']).toBe('#FFFFFF')
        const white = parseColor('#FFFFFF')
        expect(contrastRatio(white, parseColor(tokens['--color-accent']))).toBeGreaterThan(4.5)
      }
    }
  })

  test('a light custom accent switches its text to dark ink, on the canvas too', () => {
    for (const theme of THEMES) {
      const { tokens, selection } = palette('#FFEE00', theme)
      expect(tokens['--color-on-accent']).toBe('#1F2328')
      expect(tokens['--color-on-primary']).toBe('#1F2328')
      expect(selection.foreground).toEqual(parseColor('#1F2328'))
    }
  })

  test('pulls near-black and near-white picks into a visible lightness', () => {
    for (const color of ['#000000', '#FFFFFF']) {
      const lightness = rgbaToOkHCL(parseColor(palette(color, 'dark').tokens['--color-accent'])).l
      expect(lightness).toBeGreaterThan(ACCENT_LIGHTNESS_RANGE.min - 0.05)
      expect(lightness).toBeLessThan(ACCENT_LIGHTNESS_RANGE.max + 0.05)
    }
  })

  test('moves a custom accent until its text reaches AA contrast on accent and primary surfaces', () => {
    for (const color of ['#808080', '#00A0A0', '#FF4FA0']) {
      for (const theme of THEMES) {
        const { tokens } = palette(color, theme)
        const onAccent = parseColor(tokens['--color-on-accent'])
        const onPrimary = parseColor(tokens['--color-on-primary'])
        for (const surface of ['--color-accent', '--color-panel-selected'] as const) {
          expect(contrastRatio(onAccent, parseColor(tokens[surface]))).toBeGreaterThanOrEqual(4.5)
        }
        expect(
          contrastRatio(onPrimary, parseColor(tokens['--color-primary']))
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  test('the unfocused selection tint keeps the panel lightness and takes the accent hue', () => {
    const reference = rgbaToOkHCL(parseColor('#353B46'))
    const tint = rgbaToOkHCL(
      parseColor(palette('#A16207', 'dark').tokens['--color-panel-selected-muted'])
    )
    expect(tint.l).toBeCloseTo(reference.l, 2)
    const accentHue = rgbaToOkHCL(parseColor('#A16207')).h
    expect(Math.abs(tint.h - accentHue)).toBeLessThan(10)
  })

  test('the canvas selection follows the accent hue but not the interface theme', () => {
    const dark = palette('#15803D', 'dark').selection
    expect(palette('#15803D', 'light').selection).toEqual(dark)
    expect(dark.color.g).toBeGreaterThan(dark.color.b)
    expect(dark.color.g).toBeGreaterThan(dark.color.r)
  })
})
