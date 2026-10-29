import { cssTokenProperty, cssValueTokens, TOKEN_UNIT_PROPERTY } from '@open-pencil/dom-css/export'
import type { TokenUnit } from '@open-pencil/scene-graph'

/**
 * Units that resolve against the window, a container or the text, which a preview can only
 * approximate. `rem` is exact: tokens and the app both take the root as 16px.
 */
const APPROXIMATE_UNITS = /\d(?:[sld]?v(?:w|h|i|b|min|max)|cq\w+|em|ex|ch|lh)\b/

export interface CSSExpressionPreview {
  /** The value in stored units, as a number token holds it: pixels, milliseconds, degrees. */
  value: number
  /** Whether it depends on the window or the text, so it holds only where it was computed. */
  approximate: boolean
}

/**
 * What a CSS expression comes to, computed by the browser with the tokens it names: `measure`
 * applies the value to `property` with those custom properties and reads the computed value.
 * Percentages, which resolve against a container, have no preview.
 */
export function cssExpressionPreview(
  css: string,
  unit: TokenUnit,
  tokens: ReadonlyMap<string, string>,
  measure: (property: string, value: string, variables: ReadonlyMap<string, string>) => string
): CSSExpressionPreview | undefined {
  if (unit === '%' || css.includes('%')) return undefined
  const property = TOKEN_UNIT_PROPERTY[unit]
  const names = cssValueTokens(css).flatMap((token) => {
    const name = cssTokenProperty(token)
    return name ? [name] : []
  })
  const variables = new Map(
    names.flatMap((name) => {
      const value = tokens.get(name)
      return value ? [[name, value] as const] : []
    })
  )
  if (variables.size !== new Set(names).size) return undefined
  const computed = measure(property, css, variables)
  const number = Number.parseFloat(computed)
  if (!Number.isFinite(number)) return undefined
  // Durations compute in seconds; the token holds milliseconds unless its unit is seconds.
  const value = property === 'transition-duration' && unit === 'ms' ? number * 1000 : number
  const approximate =
    APPROXIMATE_UNITS.test(css) ||
    [...variables.values()].some((text) => APPROXIMATE_UNITS.test(text))
  return { value, approximate }
}
