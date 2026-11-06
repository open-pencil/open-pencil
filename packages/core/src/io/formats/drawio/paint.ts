import { styleNumber, type DrawIOStyle } from '@open-pencil/drawio'
import type { Fill, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { tryParseColor } from '@open-pencil/scene-graph/color'
import { BLACK, WHITE } from '@open-pencil/scene-graph/constants'
import { parseCSSFontFamily } from '@open-pencil/scene-graph/css'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { LabelFormat } from './label'

/**
 * The font draw.io draws with when a style names none. draw.io's own default, Helvetica, is not a
 * font every system has, so its labels take the editor's default font instead.
 */
export const DEFAULT_FONT_FAMILY = 'Inter'
/** draw.io's default label size. */
const DEFAULT_FONT_SIZE = 12

/** A colour a style sets: `none` for none, `default` for draw.io's default, otherwise CSS. */
function styleColor(style: DrawIOStyle, key: string, fallback: Color | null): Color | null {
  const value = style.values[key]
  if (value === undefined || value === 'default') return fallback
  if (value === 'none') return null
  return tryParseColor(value) ?? fallback
}

/** A 0–100 opacity a style sets, as a fraction. */
function opacity(style: DrawIOStyle, key: string): number {
  return Math.min(1, Math.max(0, styleNumber(style, key, 100) / 100))
}

function solid(color: Color, alpha: number): Fill {
  return { type: 'SOLID', color: { ...color }, opacity: alpha, visible: true }
}

/**
 * A vertex's fill and outline as a style draws them: white and black, one pixel wide, by default,
 * as draw.io draws a new shape, dashed by `dashPattern` or, with `dashed=1`, draw.io's 3-on-3 dash
 * scaled by the width.
 */
export function shapePaint(style: DrawIOStyle): Partial<SceneNode> {
  const fill = styleColor(style, 'fillColor', WHITE)
  const stroke = styleColor(style, 'strokeColor', BLACK)
  const weight = styleNumber(style, 'strokeWidth', 1)
  const dashPattern = dashOf(style, weight)
  const strokes: Stroke[] = stroke
    ? [
        {
          ...solid(stroke, opacity(style, 'strokeOpacity')),
          weight,
          align: 'CENTER',
          dashPattern
        }
      ]
    : []
  return {
    fills: fill ? [solid(fill, opacity(style, 'fillOpacity'))] : [],
    strokes,
    strokeWeight: weight,
    strokeAlign: 'CENTER',
    dashPattern,
    opacity: opacity(style, 'opacity')
  }
}

/** The dash a style draws its line with: `dashPattern` in widths, or 3-on-3 for `dashed=1`. */
export function dashOf(style: DrawIOStyle, weight: number): number[] {
  if (style.values.dashed !== '1') return []
  const pattern = (style.values.dashPattern ?? '3 3')
    .split(/\s+/)
    .map(Number.parseFloat)
    .filter((n) => Number.isFinite(n) && n > 0)
  return pattern.map((n) => n * weight)
}

/** The colour of an edge's line: `strokeColor`, black by default. */
export function lineColor(style: DrawIOStyle): Color | null {
  return styleColor(style, 'strokeColor', BLACK)
}

/** How a cell's label looks before the tags inside it change it. */
export function labelFormat(style: DrawIOStyle): LabelFormat {
  const fontStyle = styleNumber(style, 'fontStyle', 0)
  return {
    // fontStyle is a bit set: bold, italic, underline.
    bold: (fontStyle & 1) !== 0,
    italic: (fontStyle & 2) !== 0,
    underline: (fontStyle & 4) !== 0,
    size: styleNumber(style, 'fontSize', DEFAULT_FONT_SIZE),
    color: styleColor(style, 'fontColor', BLACK) ?? BLACK,
    family: parseCSSFontFamily(style.values.fontFamily) ?? DEFAULT_FONT_FAMILY
  }
}

const HORIZONTAL = new Map<string, SceneNode['textAlignHorizontal']>([
  ['left', 'LEFT'],
  ['center', 'CENTER'],
  ['right', 'RIGHT']
])
const VERTICAL = new Map<string, SceneNode['textAlignVertical']>([
  ['top', 'TOP'],
  ['middle', 'CENTER'],
  ['bottom', 'BOTTOM']
])

/** A label's text fields: its font, size, colour, and alignment, centred by default. */
export function labelFields(style: DrawIOStyle, format = labelFormat(style)): Partial<SceneNode> {
  return {
    fontFamily: format.family,
    fontWeight: format.bold ? 700 : 400,
    italic: format.italic,
    fontSize: format.size,
    textDecoration: format.underline ? 'UNDERLINE' : 'NONE',
    fills: [solid(format.color, 1)],
    textAlignHorizontal: HORIZONTAL.get(style.values.align ?? 'center') ?? 'CENTER',
    textAlignVertical: VERTICAL.get(style.values.verticalAlign ?? 'middle') ?? 'CENTER'
  }
}
