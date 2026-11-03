import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { colorToHex, colorToRgbaCSS } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

// Values as Figma's Dev Mode writes them in `getCSSAsync` (Figma desktop 126).

/** A number with at most three decimals and no trailing zeros: `0.36`, `133.333`. */
export function cssNumber(value: number): string {
  const rounded = Number(value.toFixed(3))
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

/** A length in pixels; `zero` is how a list writes 0, which a list leaves unitless. */
export function px(value: number, zero = '0px'): string {
  return value === 0 ? zero : `${cssNumber(value)}px`
}

/** An opaque color as uppercase hex, shortened where it can be (`#F00`); else `rgba()`. */
export function cssColor(color: Color, opacity = 1): string {
  const alpha = color.a * opacity
  if (alpha >= 1) {
    const hex = colorToHex(color)
    const short = /^#(.)\1(.)\2(.)\3$/.exec(hex)
    return short ? `#${short[1]}${short[2]}${short[3]}` : hex
  }
  return colorToRgbaCSS({ ...color, a: alpha }, 2)
}

/**
 * `literal`, or the variable bound to `field` around it, as Dev Mode writes one: its `WEB` code
 * syntax as given, else `var(--Name-With-Dashes, literal)`.
 */
export function boundValue(
  graph: SceneGraph,
  node: SceneNode,
  field: string,
  literal: string
): string {
  const id = node.boundVariables[field]
  const variable = id ? graph.variables.get(id) : undefined
  if (!variable) return literal
  const web = variable.codeSyntax?.WEB
  if (web) return web
  const name = variable.name.replaceAll(/[^\p{L}\p{N}]+/gu, '-').replaceAll(/^-|-$/g, '')
  return `var(--${name}, ${literal})`
}
