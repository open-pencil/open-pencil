import type {
  DesignTokenGroup,
  DesignTokenSourceFile
} from '@open-pencil/core/io/formats/design-tokens'

import { colorToken, presetTokenFile, spacingToken, stepKey } from '../tokens'
import {
  TAILWIND_PALETTES,
  TAILWIND_SHADES,
  TAILWIND_SPACING_REM,
  TAILWIND_SPACING_STEPS,
  TAILWIND_VERSION
} from './theme'

/**
 * Tailwind CSS's default colors and spacing: a `Tailwind` collection with colors as
 * `color/<palette>/<shade>` and spacing as `spacing/<step>`, each named in code by the CSS that
 * Tailwind's theme gives it.
 */
export function tailwindTokenFiles(): DesignTokenSourceFile[] {
  return presetTokenFile('Tailwind', `Tailwind CSS ${TAILWIND_VERSION} default theme`, {
    color: { ...plainColors(), ...paletteColors() },
    spacing: spacingTokens()
  })
}

function plainColors(): DesignTokenGroup {
  return {
    black: colorToken({ colorSpace: 'srgb', components: [0, 0, 0] }, 'var(--color-black)'),
    white: colorToken({ colorSpace: 'srgb', components: [1, 1, 1] }, 'var(--color-white)')
  }
}

function paletteColors(): DesignTokenGroup {
  return Object.fromEntries(
    Object.entries(TAILWIND_PALETTES).map(([palette, values]) => [
      palette,
      paletteShades(palette, values)
    ])
  )
}

function paletteShades(palette: string, values: readonly string[]): DesignTokenGroup {
  return Object.fromEntries(
    TAILWIND_SHADES.map((shade, index) => [
      shade,
      colorToken(
        { colorSpace: 'oklch', components: oklchComponents(values[index]) },
        `var(--color-${palette}-${shade})`
      )
    ])
  )
}

/** `L C H` as DTCG components; a gray's hue is `none`. */
function oklchComponents(value: string): (number | 'none')[] {
  return value.split(' ').map((part) => (part === 'none' ? 'none' : Number(part)))
}

/** `px` and the documented steps, each a multiple of `--spacing`. */
function spacingTokens(): DesignTokenGroup {
  const steps = TAILWIND_SPACING_STEPS.map((step) => [
    stepKey(step),
    spacingToken(
      step,
      { value: Number(step) * TAILWIND_SPACING_REM, unit: 'rem' },
      `calc(var(--spacing) * ${step})`
    )
  ])
  return Object.fromEntries([['px', spacingToken('px', { value: 1, unit: 'px' }, '1px')], ...steps])
}
