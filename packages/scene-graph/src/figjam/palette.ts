import { omit } from 'es-toolkit'

import { parseColor } from '../color'
import { BLACK, WHITE } from '../constants'
import type { Color } from '../primitives'
import type { Fill, SceneNode, Stroke } from '../types'

/**
 * FigJam's board palette, in its menus' order, as its colour menu paints a shape with text: each
 * fill pairs with a darker stroke, a light label on the darkest fills, and, made transparent, a
 * lighter fill and its own stroke. Its line menu and connectors take the fills as line colours, and
 * a section takes a pale tint of each with the colour itself as its outline.
 */
const PALETTE = {
  black: {
    fill: '#1e1e1e',
    stroke: '#242424',
    lightLabel: true,
    transparent: 0.5,
    transparentStroke: '#929292',
    sectionFill: '#dddddd',
    sectionStroke: '#2c2c2c'
  },
  darkGray: {
    fill: '#757575',
    stroke: '#424242',
    lightLabel: true,
    transparent: 0.5,
    transparentStroke: '#a1a1a1',
    sectionFill: '#eaeaea',
    sectionStroke: '#757575'
  },
  red: {
    fill: '#f24822',
    stroke: '#bd2915',
    lightLabel: true,
    transparent: 0.5,
    transparentStroke: '#c7968f',
    sectionFill: '#ffe2e0',
    sectionStroke: '#f24822'
  },
  orange: {
    fill: '#ff9e42',
    stroke: '#eb7500',
    lightLabel: false,
    transparent: 0.5,
    transparentStroke: '#e9b780',
    sectionFill: '#ffead6',
    sectionStroke: '#ff9e42'
  },
  yellow: {
    fill: '#ffc943',
    stroke: '#e8a302',
    lightLabel: false,
    transparent: 0.5,
    transparentStroke: '#f5d280',
    sectionFill: '#fff3d6',
    sectionStroke: '#ffc943'
  },
  green: {
    fill: '#66d575',
    stroke: '#3e9b4b',
    lightLabel: false,
    transparent: 0.5,
    transparentStroke: '#80c79e',
    sectionFill: '#ddf8e2',
    sectionStroke: '#66d575'
  },
  teal: {
    fill: '#5ad8cc',
    stroke: '#369e94',
    lightLabel: false,
    transparent: 0.5,
    transparentStroke: '#80c9c6',
    sectionFill: '#defcfa',
    sectionStroke: '#5ad8cc'
  },
  blue: {
    fill: '#3dadff',
    stroke: '#007ad2',
    lightLabel: true,
    transparent: 0.7,
    transparentStroke: '#4d99d3',
    sectionFill: '#dbf0ff',
    sectionStroke: '#3dadff'
  },
  violet: {
    fill: '#874fff',
    stroke: '#5427b4',
    lightLabel: true,
    transparent: 0.5,
    transparentStroke: '#a792d0',
    sectionFill: '#eae1ff',
    sectionStroke: '#874fff'
  },
  pink: {
    fill: '#f849c1',
    stroke: '#b42487',
    lightLabel: true,
    transparent: 0.5,
    transparentStroke: '#ce92bb',
    sectionFill: '#ffd6f2',
    sectionStroke: '#f849c1'
  },
  white: {
    fill: '#ffffff',
    stroke: '#757575',
    lightLabel: false,
    transparent: 0.5,
    transparentStroke: '#f1f1f1',
    sectionFill: '#ffffff',
    sectionStroke: '#e6e6e6'
  },
  gray: {
    fill: '#b3b3b3',
    stroke: '#797979',
    lightLabel: false,
    transparent: 0.5,
    transparentStroke: '#bcbcbc',
    sectionFill: '#f4f4f4',
    sectionStroke: '#b3b3b3'
  },
  lightGray: {
    fill: '#d9d9d9',
    stroke: '#a5a5a5',
    lightLabel: false,
    transparent: 0.7,
    transparentStroke: '#c0c0c0',
    sectionFill: '#f9f9f9',
    sectionStroke: '#d9d9d9'
  },
  lightRed: {
    fill: '#ffc7c2',
    stroke: '#f24822',
    lightLabel: false,
    transparent: 0.7,
    transparentStroke: '#ff9d8f',
    sectionFill: '#fff5f5',
    sectionStroke: '#ffc7c2'
  },
  lightOrange: {
    fill: '#ffe0c2',
    stroke: '#ff9e42',
    lightLabel: false,
    transparent: 0.7,
    transparentStroke: '#f6c34d',
    sectionFill: '#fff7f0',
    sectionStroke: '#ffe0c2'
  },
  lightYellow: {
    fill: '#ffecbd',
    stroke: '#ffc943',
    lightLabel: false,
    transparent: 0.7,
    transparentStroke: '#efd54d',
    sectionFill: '#fffbf0',
    sectionStroke: '#ffecbd'
  },
  lightGreen: {
    fill: '#cdf4d3',
    stroke: '#66d575',
    lightLabel: false,
    transparent: 0.7,
    transparentStroke: '#a8d7b4',
    sectionFill: '#ebffee',
    sectionStroke: '#cdf4d3'
  },
  lightTeal: {
    fill: '#c6faf6',
    stroke: '#5ad8cc',
    lightLabel: false,
    transparent: 0.5,
    transparentStroke: '#bcebeb',
    sectionFill: '#f1fefd',
    sectionStroke: '#c6faf6'
  },
  lightBlue: {
    fill: '#c2e5ff',
    stroke: '#3dadff',
    lightLabel: false,
    transparent: 0.7,
    transparentStroke: '#76ccff',
    sectionFill: '#f5fbff',
    sectionStroke: '#c2e5ff'
  },
  lightViolet: {
    fill: '#dcccff',
    stroke: '#874fff',
    lightLabel: false,
    transparent: 0.7,
    transparentStroke: '#d5a3ff',
    sectionFill: '#f8f5ff',
    sectionStroke: '#dcccff'
  },
  lightPink: {
    fill: '#ffc2ec',
    stroke: '#f849c1',
    lightLabel: false,
    transparent: 0.5,
    transparentStroke: '#ffaaeb',
    sectionFill: '#fff0fa',
    sectionStroke: '#ffc2ec'
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

/**
 * The palette colour an outline is drawn in: a colour itself, or the outline a section of that
 * colour takes, which is darker for black and lighter for white.
 */
export function figJamOutlineColorName(color: Color | undefined): FigJamColorName | null {
  return (
    figJamColorName(color) ??
    FIGJAM_COLOR_NAMES.find((name) => sameColor(color, parseColor(PALETTE[name].sectionStroke))) ??
    null
  )
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

/** How heavy FigJam outlines a coloured section, and a coloured layer that had no stroke. */
const SECTION_STROKE_WEIGHT = 2
const LAYER_STROKE_WEIGHT = 1

/** `strokes` recoloured, or a new stroke of `weight` when there are none. */
function strokesIn(strokes: Stroke[], color: Color, weight: number): Stroke[] {
  if (strokes.length > 0) return strokes.map((stroke) => ({ ...stroke, type: 'SOLID', color }))
  return [{ type: 'SOLID', color, opacity: 1, visible: true, weight, align: 'INSIDE' }]
}

/** A section painted `name`, as FigJam's colour menu paints one: a pale tint outlined in the colour. */
export function figJamSectionColorFields(
  section: Pick<SceneNode, 'strokes'>,
  name: FigJamColorName
): Partial<SceneNode> {
  const { sectionFill, sectionStroke } = PALETTE[name]
  return {
    fills: [{ type: 'SOLID', color: parseColor(sectionFill), opacity: 1, visible: true }],
    strokes: strokesIn(section.strokes, parseColor(sectionStroke), SECTION_STROKE_WEIGHT),
    strokeWeight: SECTION_STROKE_WEIGHT
  }
}

/**
 * The paint of `paints` the canvas shows on top: the last it draws, skipping hidden and fully
 * transparent ones, which show nothing.
 */
function drawnPaint<P extends Fill>(paints: readonly P[]): P | undefined {
  return paints.findLast((paint) => paint.visible && paint.opacity > 0)
}

/** The palette colour a section is painted, by its tint. */
export function figJamSectionColorName(section: Pick<SceneNode, 'fills'>): FigJamColorName | null {
  const fill = drawnPaint(section.fills)?.color
  return (
    FIGJAM_COLOR_NAMES.find((name) => sameColor(fill, parseColor(PALETTE[name].sectionFill))) ??
    null
  )
}

/**
 * Whether a layer takes a palette colour as its stroke alone: a line, or a pen stroke, which is a
 * vector with nothing filled. A filled vector takes it as any other layer does.
 */
function colorsStroke(node: Pick<SceneNode, 'type' | 'fills'>): boolean {
  if (node.type === 'LINE') return true
  return node.type === 'VECTOR' && !drawnPaint(node.fills)
}

/**
 * A plain layer painted `name`, as FigJam's colour menu paints one: text takes it as its fill, a
 * line or a pen stroke as its stroke, and any other layer as its fill and a stroke of the same
 * colour.
 */
export function figJamLayerColorFields(
  node: Pick<SceneNode, 'type' | 'fills' | 'strokes' | 'styleRuns'>,
  name: FigJamColorName
): Partial<SceneNode> {
  const color = figJamColor(name)
  const fills: Fill[] = [{ type: 'SOLID', color, opacity: 1, visible: true }]
  if (node.type === 'TEXT') {
    // The whole text takes the colour, ranges coloured on their own included.
    const styleRuns = node.styleRuns.map((run) => ({
      ...run,
      style: omit(run.style, ['fills', 'fillStyleId'])
    }))
    return { fills, styleRuns }
  }
  const strokes = strokesIn(node.strokes, color, LAYER_STROKE_WEIGHT)
  return colorsStroke(node) ? { strokes } : { fills, strokes }
}

/** The palette colour a plain layer shows, read where {@link figJamLayerColorFields} paints it. */
export function figJamLayerColorName(
  node: Pick<SceneNode, 'type' | 'fills' | 'strokes'>
): FigJamColorName | null {
  const paints: Fill[] = colorsStroke(node) ? node.strokes : node.fills
  return figJamColorName(drawnPaint(paints)?.color)
}
