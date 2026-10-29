import { tryParseColor } from '@open-pencil/scene-graph/color'
import { parseCSSNumber } from '@open-pencil/scene-graph/css'
import type { Color } from '@open-pencil/scene-graph/primitives'

/** What Mermaid's CSS declarations set that a layer can show; `null` colours are `none`. */
export interface FlowStyle {
  fill?: Color | null
  stroke?: Color | null
  strokeWidth?: number
  dashPattern?: number[]
  /** The label's colour. */
  color?: Color
}

function color(value: string): Color | null | undefined {
  if (value === 'none' || value === 'transparent') return null
  return tryParseColor(value) ?? undefined
}

/**
 * Mermaid's `fill:#f96`, `stroke-width:4px`, … declarations, later ones winning. Declarations no
 * layer property stands for, such as `font-family`, are left out.
 */
export function readStyle(declarations: Iterable<string>): FlowStyle {
  const style: FlowStyle = {}
  for (const declaration of declarations) {
    const colon = declaration.indexOf(':')
    if (colon === -1) continue
    const property = declaration.slice(0, colon).trim().toLowerCase()
    const value = declaration
      .slice(colon + 1)
      .replace(/!important/i, '')
      .trim()
    switch (property) {
      case 'fill':
      case 'background':
      case 'background-color': {
        const parsed = color(value)
        if (parsed !== undefined) style.fill = parsed
        break
      }
      case 'stroke': {
        const parsed = color(value)
        if (parsed !== undefined) style.stroke = parsed
        break
      }
      case 'color': {
        const parsed = color(value)
        if (parsed) style.color = parsed
        break
      }
      case 'stroke-width': {
        const width = parseCSSNumber(value)
        if (width !== null && width >= 0) style.strokeWidth = width
        break
      }
      case 'stroke-dasharray': {
        const dashes = value
          .split(/[\s,]+/)
          .map((part) => parseCSSNumber(part))
          .filter((part): part is number => part !== null && part >= 0)
        if (dashes.length > 0) style.dashPattern = dashes.some((dash) => dash > 0) ? dashes : []
        break
      }
    }
  }
  return style
}

/**
 * The declarations that style a node or subgraph: `classDef default`, then its classes in order,
 * then its own `style` statements.
 */
export function declarationsFor(
  classDefs: Map<string, string[]>,
  classes: string[],
  styles: string[]
): string[] {
  return [
    ...(classDefs.get('default') ?? []),
    ...classes.flatMap((name) => classDefs.get(name) ?? []),
    ...styles
  ]
}
