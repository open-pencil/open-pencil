import { difference, isPlainObject } from 'es-toolkit'

import { property } from '../components/properties'
import type { DesignJSXHelperDefinition } from '../definitions'
import { ref } from '../refs'
import { defineMode, defineVars, designMode, designVar } from '../variables'
import {
  backgroundBlur,
  dropShadow,
  foregroundBlur,
  innerShadow,
  layerBlur,
  type BlurEffectOptions,
  type ShadowEffectOptions
} from './effects'
import {
  angularGradient,
  diamondGradient,
  gradient,
  linearGradient,
  radialGradient,
  shader,
  solid,
  type GradientPaintOptions,
  type SolidPaintOptions
} from './paints'

/** Every option a helper reads; `satisfies` keeps the list equal to the options type. */
type OptionKeys<Options> = Record<keyof Options, true>

const SHADOW_OPTIONS = {
  color: true,
  x: true,
  y: true,
  offset: true,
  radius: true,
  spread: true,
  visible: true,
  blendMode: true,
  showShadowBehindNode: true
} satisfies OptionKeys<ShadowEffectOptions>

const BLUR_OPTIONS = {
  radius: true,
  visible: true
} satisfies OptionKeys<BlurEffectOptions>

const SOLID_OPTIONS = {
  opacity: true,
  visible: true,
  blendMode: true
} satisfies OptionKeys<SolidPaintOptions>

const GRADIENT_OPTIONS = {
  ...SOLID_OPTIONS,
  transform: true
} satisfies OptionKeys<GradientPaintOptions>

/** Option names people reach for that the helpers spell as Figma's effects do. */
const FIGMA_OPTION_NAMES: Record<string, string> = { blur: 'radius' }

function unsupportedOptionWarning(name: string, key: string, known: string[]): string {
  const figmaName = FIGMA_OPTION_NAMES[key]
  const hint =
    figmaName && known.includes(figmaName)
      ? `Use "${figmaName}", the name Figma uses.`
      : `Supported options: ${known.join(', ')}.`
  return `Unsupported option "${key}" in ${name}() is ignored. ${hint}`
}

/**
 * Wrap a helper so each option it ignores adds a warning instead of vanishing, which is
 * what happens to a misspelled option. `optionsAt` is the argument holding the options.
 */
function checked<Args extends unknown[], Result>(
  warnings: string[],
  name: string,
  helper: (...args: Args) => Result,
  options: object,
  optionsAt: number
): (...args: Args) => Result {
  const known = Object.keys(options)
  return (...args) => {
    const passed = args[optionsAt]
    if (isPlainObject(passed)) {
      for (const key of difference(Object.keys(passed), known)) {
        warnings.push(unsupportedOptionWarning(name, key, known))
      }
    }
    return helper(...args)
  }
}

/**
 * Every helper Design JSX code can call, reporting ignored options to `warnings`. This is the
 * one list of them: the string renderer's scope, the code panel's sandbox, the editor's
 * completions, and the authoring reference all read it.
 */
export function designJSXHelpers(warnings: string[]) {
  return {
    solid: checked(warnings, 'solid', solid, SOLID_OPTIONS, 1),
    gradient: checked(warnings, 'gradient', gradient, GRADIENT_OPTIONS, 2),
    linearGradient: checked(warnings, 'linearGradient', linearGradient, GRADIENT_OPTIONS, 1),
    radialGradient: checked(warnings, 'radialGradient', radialGradient, GRADIENT_OPTIONS, 1),
    angularGradient: checked(warnings, 'angularGradient', angularGradient, GRADIENT_OPTIONS, 1),
    diamondGradient: checked(warnings, 'diamondGradient', diamondGradient, GRADIENT_OPTIONS, 1),
    shader: checked(warnings, 'shader', shader, SOLID_OPTIONS, 1),
    dropShadow: checked(warnings, 'dropShadow', dropShadow, SHADOW_OPTIONS, 0),
    innerShadow: checked(warnings, 'innerShadow', innerShadow, SHADOW_OPTIONS, 0),
    layerBlur: checked(warnings, 'layerBlur', layerBlur, BLUR_OPTIONS, 0),
    backgroundBlur: checked(warnings, 'backgroundBlur', backgroundBlur, BLUR_OPTIONS, 0),
    foregroundBlur: checked(warnings, 'foregroundBlur', foregroundBlur, BLUR_OPTIONS, 0),
    defineVars,
    defineMode,
    designVar,
    designMode,
    property,
    ref
  }
}

export type DesignJSXHelperName = keyof ReturnType<typeof designJSXHelpers>

export const DESIGN_JSX_HELPERS: DesignJSXHelperDefinition[] = Object.keys(
  designJSXHelpers([])
).map((name) => ({ name, description: `OpenPencil ${name} helper.` }))
