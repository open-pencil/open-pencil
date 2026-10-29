import { parseColor } from '../color'
import { BLACK, WHITE } from '../constants'
import type { Color } from '../primitives'
import type { Fill, SceneNode, Stroke } from '../types'

/**
 * FigJam's board palette, in its menus' order, as its colour menu paints a shape with text: each
 * fill pairs with a darker stroke, a light label on the darkest fills, and, made transparent, a
 * lighter fill and its own stroke. Its line menu and connectors take the fills as line colours.
 */
const PALETTE = {
  black: {
    fill: '#1e1e1e',
    stroke: '#242424',
    lightLabel: true,
    transparent: 0.5,
    transparentStroke: '#929292'
  },
  darkGray: {
    fill: '#757575',
    stroke: '#424242',
    lightLabel: true,
    transparent: 0.5,
    transparentStroke: '#a1a1a1'
  },
  red: {
    fill: '#f24822',
    stroke: '#bd2915',
    lightLabel: true,
    transparent: 0.5,
    transparentStroke: '#c7968f'
  },
  orange: {
    fill: '#ff9e42',
    stroke: '#eb7500',
    lightLabel: false,
    transparent: 0.5,
    transparentStroke: '#e9b780'
  },
  yellow: {
    fill: '#ffc943',
    stroke: '#e8a302',
    lightLabel: false,
    transparent: 0.5,
    transparentStroke: '#f5d280'
  },
  green: {
    fill: '#66d575',
    stroke: '#3e9b4b',
    lightLabel: false,
    transparent: 0.5,
    transparentStroke: '#80c79e'
  },
  teal: {
    fill: '#5ad8cc',
    stroke: '#369e94',
    lightLabel: false,
    transparent: 0.5,
    transparentStroke: '#80c9c6'
  },
  blue: {
    fill: '#3dadff',
    stroke: '#007ad2',
    lightLabel: true,
    transparent: 0.7,
    transparentStroke: '#4d99d3'
  },
  violet: {
    fill: '#874fff',
    stroke: '#5427b4',
    lightLabel: true,
    transparent: 0.5,
    transparentStroke: '#a792d0'
  },
  pink: {
    fill: '#f849c1',
    stroke: '#b42487',
    lightLabel: true,
    transparent: 0.5,
    transparentStroke: '#ce92bb'
  },
  white: {
    fill: '#ffffff',
    stroke: '#757575',
    lightLabel: false,
    transparent: 0.5,
    transparentStroke: '#f1f1f1'
  },
  gray: {
    fill: '#b3b3b3',
    stroke: '#797979',
    lightLabel: false,
    transparent: 0.5,
    transparentStroke: '#bcbcbc'
  },
  lightGray: {
    fill: '#d9d9d9',
    stroke: '#a5a5a5',
    lightLabel: false,
    transparent: 0.7,
    transparentStroke: '#c0c0c0'
  },
  lightRed: {
    fill: '#ffc7c2',
    stroke: '#f24822',
    lightLabel: false,
    transparent: 0.7,
    transparentStroke: '#ff9d8f'
  },
  lightOrange: {
    fill: '#ffe0c2',
    stroke: '#ff9e42',
    lightLabel: false,
    transparent: 0.7,
    transparentStroke: '#f6c34d'
  },
  lightYellow: {
    fill: '#ffecbd',
    stroke: '#ffc943',
    lightLabel: false,
    transparent: 0.7,
    transparentStroke: '#efd54d'
  },
  lightGreen: {
    fill: '#cdf4d3',
    stroke: '#66d575',
    lightLabel: false,
    transparent: 0.7,
    transparentStroke: '#a8d7b4'
  },
  lightTeal: {
    fill: '#c6faf6',
    stroke: '#5ad8cc',
    lightLabel: false,
    transparent: 0.5,
    transparentStroke: '#bcebeb'
  },
  lightBlue: {
    fill: '#c2e5ff',
    stroke: '#3dadff',
    lightLabel: false,
    transparent: 0.7,
    transparentStroke: '#76ccff'
  },
  lightViolet: {
    fill: '#dcccff',
    stroke: '#874fff',
    lightLabel: false,
    transparent: 0.7,
    transparentStroke: '#d5a3ff'
  },
  lightPink: {
    fill: '#ffc2ec',
    stroke: '#f849c1',
    lightLabel: false,
    transparent: 0.5,
    transparentStroke: '#ffaaeb'
  }
} as const

export type FigJamColorName = keyof typeof PALETTE

export const FIGJAM_COLOR_NAMES = Object.keys(PALETTE) as FigJamColorName[]

/** How a shape's colour fills it: solid, see-through, or not at all, as FigJam's menu sets it. */
export type FigJamFillMode = 'fill' | 'transparent' | 'none'

/** How a shape's outline is drawn, as FigJam's line menu sets it. */
export type FigJamLineStyle = 'solid' | 'dashed' | 'none'

/** The dash FigJam's line menu draws a shape's outline with. */
export const FIGJAM_SHAPE_DASH = [16, 10] as const

/** A palette colour as a colour. */
export function figJamColor(name: FigJamColorName): Color {
  return parseColor(PALETTE[name].fill)
}

function sameColor(a: Color | undefined, b: Color): boolean {
  if (!a) return false
  const close = (x: number, y: number) => Math.abs(x - y) < 1 / 512
  return close(a.r, b.r) && close(a.g, b.g) && close(a.b, b.b)
}

/** The palette colour a paint is, if any. */
export function figJamColorName(color: Color | undefined): FigJamColorName | null {
  return FIGJAM_COLOR_NAMES.find((name) => sameColor(color, figJamColor(name))) ?? null
}

/** The fill mode a shape's first fill shows. */
export function figJamFillMode(fill: Fill | undefined): FigJamFillMode {
  if (!fill || !fill.visible || fill.opacity === 0) return 'none'
  return fill.opacity < 1 ? 'transparent' : 'fill'
}

/** The outline FigJam pairs with a colour in a fill mode. */
export function figJamPairedStroke(name: FigJamColorName, mode: FigJamFillMode): Color {
  const entry = PALETTE[name]
  return parseColor(mode === 'fill' ? entry.stroke : entry.transparentStroke)
}

/** The label paint FigJam pairs with a colour in a fill mode. */
function pairedLabel(name: FigJamColorName, mode: FigJamFillMode): Fill {
  const light = PALETTE[name].lightLabel && (mode === 'fill' || name === 'black') && mode !== 'none'
  return light
    ? { type: 'SOLID', color: { ...WHITE }, opacity: 1, visible: true }
    : { type: 'SOLID', color: { ...BLACK }, opacity: 0.8, visible: true }
}

/** How opaque FigJam fills a colour in a fill mode. */
function fillOpacity(name: FigJamColorName, mode: FigJamFillMode): number {
  if (mode === 'transparent') return PALETTE[name].transparent
  return mode === 'fill' ? 1 : 0
}

/** What a shape with text and its label become when painted `name` in `mode`. */
export interface FigJamShapePaint {
  shape: Partial<SceneNode>
  label: Partial<SceneNode>
}

/**
 * A shape painted `name` in `mode`, as FigJam's colour menu paints it. The stroke and label follow
 * the colour only while they are still the ones FigJam paired with the current paint: a line or
 * text colour set by hand stays.
 */
export function figJamShapePaint(
  shape: Pick<SceneNode, 'fills' | 'strokes'>,
  label: Pick<SceneNode, 'fills'> | null,
  name: FigJamColorName,
  mode: FigJamFillMode
): FigJamShapePaint {
  const fill = shape.fills.at(0)
  const current = figJamColorName(fill?.color)
  const currentMode = figJamFillMode(fill)
  const opacity = fillOpacity(name, mode)
  const result: FigJamShapePaint = {
    shape: { fills: [{ type: 'SOLID', color: figJamColor(name), opacity, visible: true }] },
    label: {}
  }
  const stroke = shape.strokes.at(0)
  const strokeFollows =
    !stroke || !current || sameColor(stroke.color, figJamPairedStroke(current, currentMode))
  if (stroke && strokeFollows) {
    result.shape.strokes = [
      { ...stroke, color: figJamPairedStroke(name, mode) },
      ...shape.strokes.slice(1)
    ]
  }
  const labelFill = label?.fills.at(0)
  const paired = current ? pairedLabel(current, currentMode) : null
  const labelFollows =
    !labelFill ||
    !paired ||
    (sameColor(labelFill.color, paired.color) &&
      Math.abs(labelFill.opacity - paired.opacity) < 0.01)
  if (label && labelFollows) result.label = { fills: [pairedLabel(name, mode)] }
  return result
}

/**
 * A shape's outline drawn `style`, as FigJam's line menu draws it; the weight stays. The dash is
 * the layer's, as files keep it, and each stroke's, as it is drawn.
 */
export function figJamLineStyleFields(
  shape: Pick<SceneNode, 'strokes'>,
  style: FigJamLineStyle
): Partial<SceneNode> {
  const dashPattern = style === 'dashed' ? [...FIGJAM_SHAPE_DASH] : []
  const strokes = shape.strokes.map((stroke): Stroke => ({
    ...stroke,
    opacity: style === 'none' ? 0 : 1,
    dashPattern: [...dashPattern]
  }))
  return { strokes, dashPattern }
}

/** The line style a shape's outline shows. */
export function figJamLineStyle(shape: Pick<SceneNode, 'strokes'>): FigJamLineStyle {
  const stroke = shape.strokes.at(0)
  if (!stroke || !stroke.visible || stroke.opacity === 0) return 'none'
  return (stroke.dashPattern?.length ?? 0) > 0 ? 'dashed' : 'solid'
}

/**
 * A shape's outline in palette colour `name`, as FigJam's line menu colours it; a hidden outline
 * shows again, keeping its dash.
 */
export function figJamLineColorFields(
  shape: Pick<SceneNode, 'strokes'>,
  name: FigJamColorName
): Partial<SceneNode> {
  const color = figJamColor(name)
  const strokes =
    shape.strokes.length > 0
      ? shape.strokes.map((stroke): Stroke => ({ ...stroke, color, opacity: 1 }))
      : [
          {
            type: 'SOLID',
            color,
            opacity: 1,
            visible: true,
            weight: 4,
            align: 'CENTER'
          } satisfies Stroke
        ]
  return { strokes }
}
