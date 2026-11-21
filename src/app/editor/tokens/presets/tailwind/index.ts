import {
  OPENPENCIL_EXTENSION,
  type DesignTokenGroup,
  type DesignTokenSourceFile
} from '@open-pencil/core/io/formats/design-tokens'
import type { VariableScope } from '@open-pencil/scene-graph'

import {
  TAILWIND_PALETTES,
  TAILWIND_SHADES,
  TAILWIND_SPACING_REM,
  TAILWIND_SPACING_STEPS,
  TAILWIND_VERSION
} from './theme'

/** Where padding, gaps, and sizes offer the spacing tokens, as Tailwind's spacing utilities do. */
const SPACING_SCOPES: VariableScope[] = ['GAP', 'WIDTH_HEIGHT']

/**
 * Tailwind CSS's default colors and spacing as one design token file: a `Tailwind` collection
 * with one mode, colors as `color/<palette>/<shade>` and spacing as `spacing/<step>`, each named
 * in code by the CSS that Tailwind's theme gives it.
 */
export function tailwindTokenFiles(): DesignTokenSourceFile[] {
  const document: DesignTokenGroup = {
    $description: `Tailwind CSS ${TAILWIND_VERSION} default theme`,
    $extensions: { [OPENPENCIL_EXTENSION]: { collection: 'Tailwind', mode: 'Default' } },
    color: { $type: 'color', ...plainColors(), ...paletteColors() },
    spacing: { $type: 'dimension', ...spacingTokens() }
  }
  return [{ path: 'tailwind.tokens.json', text: JSON.stringify(document) }]
}

function plainColors(): DesignTokenGroup {
  return {
    black: colorToken('black', 'srgb', [0, 0, 0]),
    white: colorToken('white', 'srgb', [1, 1, 1])
  }
}

function paletteColors(): DesignTokenGroup {
  return Object.fromEntries(
    Object.entries(TAILWIND_PALETTES).map(([palette, shades]) => [
      palette,
      paletteShades(palette, shades)
    ])
  )
}

function paletteShades(palette: string, values: readonly string[]): DesignTokenGroup {
  return Object.fromEntries(
    TAILWIND_SHADES.map((shade, index) => [
      shade,
      colorToken(`${palette}-${shade}`, 'oklch', oklchComponents(values[index]))
    ])
  )
}

/** `L C H` as DTCG components; a gray's hue is `none`. */
function oklchComponents(value: string): (number | 'none')[] {
  return value.split(' ').map((part) => (part === 'none' ? 'none' : Number(part)))
}

function colorToken(cssName: string, colorSpace: string, components: (number | 'none')[]) {
  return {
    $value: { colorSpace, components },
    $extensions: { [OPENPENCIL_EXTENSION]: { codeSyntax: { WEB: `var(--color-${cssName})` } } }
  }
}

/** The documented steps and `px`; a step's key cannot hold a dot, so `0.5` is named apart. */
function spacingTokens(): DesignTokenGroup {
  const steps = TAILWIND_SPACING_STEPS.map((step) => [
    step.replace('.', '_'),
    spacingToken(step, { value: Number(step) * TAILWIND_SPACING_REM, unit: 'rem' }, 'rem')
  ])
  return Object.fromEntries([['px', spacingToken('px', { value: 1, unit: 'px' }, 'px')], ...steps])
}

function spacingToken(step: string, value: { value: number; unit: string }, unit: string) {
  const web = step === 'px' ? '1px' : `calc(var(--spacing) * ${step})`
  return {
    $value: value,
    $extensions: {
      [OPENPENCIL_EXTENSION]: {
        name: `spacing/${step}`,
        unit,
        scopes: SPACING_SCOPES,
        codeSyntax: { WEB: web }
      }
    }
  }
}
