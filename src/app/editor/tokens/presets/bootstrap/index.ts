import type {
  DesignTokenGroup,
  DesignTokenSourceFile
} from '@open-pencil/core/io/formats/design-tokens'

import { aliasToken, colorToken, presetTokenFile, spacingToken } from '../tokens'
import {
  BOOTSTRAP_PALETTES,
  BOOTSTRAP_SHADES,
  BOOTSTRAP_SPACERS,
  BOOTSTRAP_THEME_COLORS,
  BOOTSTRAP_VERSION
} from './theme'

/**
 * Bootstrap's default colors and spacers: a `Bootstrap` collection with each color's shades as
 * `color/<color>/<shade>`, the theme colors (`color/primary`...) pointing at the shade they are,
 * and the spacers as `spacing/<n>`. Tokens Bootstrap's CSS defines are named in code by it.
 */
export function bootstrapTokenFiles(): DesignTokenSourceFile[] {
  return presetTokenFile('Bootstrap', `Bootstrap ${BOOTSTRAP_VERSION} default theme`, {
    color: { ...plainColors(), ...paletteColors(), ...themeColors() },
    spacing: spacingTokens()
  })
}

function plainColors(): DesignTokenGroup {
  return {
    black: colorToken('#000000', 'var(--bs-black)'),
    white: colorToken('#FFFFFF', 'var(--bs-white)')
  }
}

function paletteColors(): DesignTokenGroup {
  return Object.fromEntries(
    Object.entries(BOOTSTRAP_PALETTES).map(([palette, values]) => [
      palette,
      paletteShades(palette, values)
    ])
  )
}

function paletteShades(palette: string, values: readonly string[]): DesignTokenGroup {
  return Object.fromEntries(
    BOOTSTRAP_SHADES.map((shade, index) => [
      shade,
      colorToken(values[index], cssVariableOf(palette, shade))
    ])
  )
}

/**
 * Bootstrap's CSS defines `--bs-<color>` for each color's own shade, 500, and `--bs-gray-<shade>`
 * for every gray; the other shades exist only in its Sass.
 */
function cssVariableOf(palette: string, shade: string): string | undefined {
  if (palette === 'gray') return `var(--bs-gray-${shade})`
  return shade === '500' ? `var(--bs-${palette})` : undefined
}

function themeColors(): DesignTokenGroup {
  return Object.fromEntries(
    Object.entries(BOOTSTRAP_THEME_COLORS).map(([name, [palette, shade]]) => [
      name,
      aliasToken(`color.${palette}.${shade}`, `var(--bs-${name})`)
    ])
  )
}

function spacingTokens(): DesignTokenGroup {
  return Object.fromEntries(
    Object.entries(BOOTSTRAP_SPACERS).map(([step, rem]) => [
      step,
      spacingToken(step, { value: rem, unit: 'rem' })
    ])
  )
}
