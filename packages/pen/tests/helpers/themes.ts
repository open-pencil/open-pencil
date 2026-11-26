import type { PenDocument } from '@open-pencil/pen'

type PenVariable = NonNullable<PenDocument['variables']>[string]
type Scalar = string | number | boolean

/** The `semantic` axis the theme tests switch between, light first as pen.dev's default. */
export const SEMANTIC_THEMES: PenDocument['themes'] = { semantic: ['light', 'dark'] }

/** A variable holding `light` in the light theme and `dark` in the dark one. */
export function lightDark(type: string, light: Scalar, dark: Scalar): PenVariable {
  return {
    type,
    value: [
      { value: light, theme: { semantic: 'light' } },
      { value: dark, theme: { semantic: 'dark' } }
    ]
  }
}

/** `surface`, the colour the theme tests fill with: white in light, #222222 in dark. */
export const SURFACE = lightDark('color', '#FFFFFF', '#222222')
export const LIGHT_SURFACE = { r: 1, g: 1, b: 1, a: 1 }
export const DARK_SURFACE = { r: 0x22 / 255, g: 0x22 / 255, b: 0x22 / 255, a: 1 }
