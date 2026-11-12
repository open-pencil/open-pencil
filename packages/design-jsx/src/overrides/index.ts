import * as v from 'valibot'

import type { Fill, SceneNode, ArcData, NodeType } from '@open-pencil/scene-graph'
import { colorToFill } from '@open-pencil/scene-graph/color'
import { parseCSSGridTracks, parseCSSNumber } from '@open-pencil/scene-graph/css'
import {
  autoLayoutSizingFields,
  clampFontSize,
  clampGridTracks,
  clampLayoutLength,
  clampLayoutPosition,
  fillSizingFields,
  MAX_LAYOUT_FACTOR,
  MAX_LAYOUT_SPACING,
  parseAutoLayoutDirection,
  parseCounterAxisAlign,
  parsePrimaryAxisAlign
} from '@open-pencil/scene-graph/layout'
import type { Color, JSONObject } from '@open-pencil/scene-graph/primitives'
import { withShaderPaints, type ShaderPaint } from '@open-pencil/scene-graph/shaders'

import { DESIGN_JSX_STYLE_KEYS, designJSXProp } from '../definitions'
import {
  BLEND_MODE,
  TEXT_ALIGN,
  TEXT_ALIGN_VERTICAL,
  TEXT_AUTO_RESIZE,
  TEXT_CASE,
  TEXT_DECORATION,
  TEXT_DIRECTION
} from '../enums'
import { isShaderFill } from '../helpers/paints'
import { gridLineValueSchema, gridSpanValueSchema, gridTrackCountValueSchema } from '../schema'
import { applyEffectOverrides } from './effects'
import { fillFromValue, isColor, isFillValue } from './fills'
import { applyStateOverrides } from './state'
import { applyStrokeOverrides } from './strokes'
import { applyTextDetailOverrides, AUTO, textLengthProp } from './text'

const WEIGHT_MAP: Record<string, number> = {
  normal: 400,
  medium: 500,
  bold: 700
}

/** The most points a polygon or star may be drawn with, as the layer stores it. */
const MAX_POINT_COUNT = 1_000

/** A size, radius, or growth as an element may set it: finite, non-negative, and bounded. */
function layoutLengthProp(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? clampLayoutLength(value) : undefined
}

/** A gap or padding, which layout computes with directly. */
function layoutSpacingProp(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? clampLayoutLength(value, MAX_LAYOUT_SPACING)
    : undefined
}

/** A unitless share, such as how much free space a growing layer takes. */
function layoutFactorProp(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? clampLayoutLength(value, MAX_LAYOUT_FACTOR)
    : undefined
}

/** A position that may lie outside its parent, such as an absolutely placed layer. */
function layoutPositionProp(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? clampLayoutPosition(value)
    : undefined
}

function fontSizeProp(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? clampFontSize(value) : undefined
}

/** What `schema` reads from `value`; undefined when it does not fit, as the warning reports. */
function propValue<S extends v.GenericSchema>(
  schema: S,
  value: unknown
): v.InferOutput<S> | undefined {
  const parsed = v.safeParse(schema, value)
  return parsed.success ? parsed.output : undefined
}

/** A share of a shape, such as a star's inner radius or an arc's hole, from none to all of it. */
function shareOfShape(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : undefined
}

function parseDirection(value: unknown): SceneNode['textDirection'] | undefined {
  if (typeof value !== 'string') return undefined
  return TEXT_DIRECTION.parse(value) ?? 'AUTO'
}

function numberFromPx(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  return typeof value === 'string' ? (parseCSSNumber(value) ?? undefined) : undefined
}

/** `props` with the sizes and styles its `style` object gives, where the props leave them unset. */
export function normalizeStyleProps(props: Record<string, unknown>): Record<string, unknown> {
  const style = props.style
  if (style === null || typeof style !== 'object' || Array.isArray(style)) return props

  const source = style as JSONObject
  const normalized = { ...props }
  for (const [name, keys] of Object.entries(DESIGN_JSX_STYLE_KEYS)) {
    if (designJSXProp(normalized, name) !== undefined) continue
    const found = keys.find(({ key }) => source[key] !== undefined)
    if (found) normalized[name] = found.px ? numberFromPx(source[found.key]) : source[found.key]
  }
  return normalized
}

export function applySizeOverrides(
  props: Record<string, unknown>,
  o: Partial<SceneNode>,
  parentLayout: SceneNode['layoutMode']
): { w: unknown; h: unknown } {
  const w = designJSXProp(props, 'w')
  const h = designJSXProp(props, 'h')
  const width = layoutLengthProp(w)
  const height = layoutLengthProp(h)
  if (width !== undefined) o.width = width
  if (height !== undefined) o.height = height

  if (w === 'fill') Object.assign(o, fillSizingFields(parentLayout, 'HORIZONTAL'))
  if (h === 'fill') Object.assign(o, fillSizingFields(parentLayout, 'VERTICAL'))

  const x = layoutPositionProp(props.x)
  if (x !== undefined) o.x = x
  const y = layoutPositionProp(props.y)
  if (y !== undefined) o.y = y
  const top = layoutPositionProp(props.top)
  if (top !== undefined) o.y = top
  const left = layoutPositionProp(props.left)
  if (left !== undefined) o.x = left

  if (props.position === 'absolute') o.layoutPositioning = 'ABSOLUTE'
  const hasExplicitPosition =
    props.x !== undefined ||
    props.y !== undefined ||
    props.top !== undefined ||
    props.left !== undefined
  if (hasExplicitPosition && parentLayout !== 'NONE') {
    o.layoutPositioning = 'ABSOLUTE'
  }

  return { w, h }
}

/**
 * Sets the layer's fills, moving each shader paint's preset into the layer's plugin data,
 * where a shader paint keeps it.
 */
function setFills(values: (string | Color | Fill)[], o: Partial<SceneNode>): void {
  const shaders: ShaderPaint[] = []
  const fills = values.map((value) => {
    const fill = fillFromValue(value)
    if (!isShaderFill(fill)) return fill
    const { shader, ...paint } = fill
    if (paint.imageHash) shaders.push({ image: paint.imageHash, preset: shader })
    return paint
  })
  if (fills.length === 0) return
  o.fills = fills
  if (shaders.length > 0)
    o.pluginData = withShaderPaints({ pluginData: o.pluginData ?? [] }, fills, shaders)
}

function applyFillOverride(props: Record<string, unknown>, o: Partial<SceneNode>): void {
  // `fills={[]}` paints nothing, which a text, painted black by default, has to say.
  if (Array.isArray(props.fills) && props.fills.length === 0) {
    o.fills = []
    return
  }
  if (Array.isArray(props.fills)) {
    setFills(props.fills.filter(isFillValue), o)
    return
  }

  const bg = designJSXProp(props, 'bg')
  if (isFillValue(bg)) setFills([bg], o)
}

function applyCornerOverrides(props: Record<string, unknown>, o: Partial<SceneNode>): void {
  const rounded = designJSXProp(props, 'rounded')
  if (typeof rounded === 'number') o.cornerRadius = rounded

  if (
    props.roundedTL !== undefined ||
    props.roundedTR !== undefined ||
    props.roundedBL !== undefined ||
    props.roundedBR !== undefined
  ) {
    o.independentCorners = true
    if (props.roundedTL !== undefined) o.topLeftRadius = props.roundedTL as number
    if (props.roundedTR !== undefined) o.topRightRadius = props.roundedTR as number
    if (props.roundedBL !== undefined) o.bottomLeftRadius = props.roundedBL as number
    if (props.roundedBR !== undefined) o.bottomRightRadius = props.roundedBR as number
  }

  if (props.cornerSmoothing !== undefined) o.cornerSmoothing = props.cornerSmoothing as number
}

function applyVisualOverrides(props: Record<string, unknown>, o: Partial<SceneNode>): void {
  applyFillOverride(props, o)
  applyStrokeOverrides(props, o)
  applyCornerOverrides(props, o)

  if (props.opacity !== undefined) o.opacity = props.opacity as number
  applyTransformOverrides(props, o)
  const blendMode = BLEND_MODE.parse(props.blendMode)
  if (blendMode) o.blendMode = blendMode
  if (props.overflow === 'hidden') o.clipsContent = true
}

function applyTransformOverrides(props: Record<string, unknown>, o: Partial<SceneNode>): void {
  const rotation = designJSXProp(props, 'rotate')
  if (rotation !== undefined) o.rotation = rotation as number
  if (props.flipX !== undefined) o.flipX = props.flipX === true
  if (props.flipY !== undefined) o.flipY = props.flipY === true
}

function applyPaddingOverrides(props: Record<string, unknown>, o: Partial<SceneNode>): void {
  const p = layoutSpacingProp(designJSXProp(props, 'p'))
  if (p !== undefined) {
    o.paddingTop = p
    o.paddingRight = p
    o.paddingBottom = p
    o.paddingLeft = p
  }
  const px = layoutSpacingProp(props.px)
  const py = layoutSpacingProp(props.py)
  if (px !== undefined) {
    o.paddingLeft = px
    o.paddingRight = px
  }
  if (py !== undefined) {
    o.paddingTop = py
    o.paddingBottom = py
  }
  const pt = layoutSpacingProp(props.pt)
  if (pt !== undefined) o.paddingTop = pt
  const pr = layoutSpacingProp(props.pr)
  if (pr !== undefined) o.paddingRight = pr
  const pb = layoutSpacingProp(props.pb)
  if (pb !== undefined) o.paddingBottom = pb
  const pl = layoutSpacingProp(props.pl)
  if (pl !== undefined) o.paddingLeft = pl
}

const PADDING_KEYS = ['p', 'padding', 'px', 'py', 'pt', 'pr', 'pb', 'pl'] as const
const AUTO_LAYOUT_TRIGGER_KEYS = [
  ...PADDING_KEYS,
  'justify',
  'justifyContent',
  'items',
  'align',
  'alignItems'
] as const

function hasAutoLayoutTriggerProps(props: Record<string, unknown>): boolean {
  return AUTO_LAYOUT_TRIGGER_KEYS.some((k) => props[k] !== undefined)
}

function applyGridOverrides(
  props: Record<string, unknown>,
  o: Partial<SceneNode>,
  w: unknown,
  h: unknown
): void {
  o.layoutMode = 'GRID'

  const width = layoutLengthProp(w)
  const height = layoutLengthProp(h)
  if (width !== undefined) o.width = width
  if (height !== undefined) o.height = height

  if (typeof props.columns === 'string') {
    o.gridTemplateColumns = clampGridTracks(parseCSSGridTracks(props.columns))
  } else {
    const columns = propValue(gridTrackCountValueSchema, props.columns)
    if (columns !== undefined) {
      o.gridTemplateColumns = Array.from({ length: columns }, () => ({
        sizing: 'FR' as const,
        value: 1
      }))
    }
  }

  if (typeof props.rows === 'string') {
    o.gridTemplateRows = clampGridTracks(parseCSSGridTracks(props.rows))
  } else {
    const rows = propValue(gridTrackCountValueSchema, props.rows)
    if (rows !== undefined) {
      o.gridTemplateRows = Array.from({ length: rows }, () => ({
        sizing: 'FR' as const,
        value: 1
      }))
    }
  }

  const columnGap = layoutSpacingProp(props.columnGap)
  if (columnGap !== undefined) o.gridColumnGap = columnGap
  const rowGap = layoutSpacingProp(props.rowGap)
  if (rowGap !== undefined) o.gridRowGap = rowGap
  const gap = layoutSpacingProp(props.gap)
  if (gap !== undefined) {
    o.gridColumnGap = gap
    o.gridRowGap = gap
  }

  if (props.rows === undefined && typeof h !== 'number') {
    o.height = 0
  }
}

function applyGridChildOverrides(props: Record<string, unknown>, o: Partial<SceneNode>): void {
  const col = propValue(gridLineValueSchema, designJSXProp(props, 'colStart'))
  const row = propValue(gridLineValueSchema, designJSXProp(props, 'rowStart'))
  if (col === undefined && row === undefined) return

  o.gridPosition = {
    column: col ?? 0,
    row: row ?? 0,
    // A span that is not a positive whole number is left out as the warning reports: layout
    // cannot place it, and auto placement is what the layer had before.
    columnSpan: propValue(gridSpanValueSchema, props.colSpan) ?? 1,
    rowSpan: propValue(gridSpanValueSchema, props.rowSpan) ?? 1
  }
}

function applyAutoLayoutSizing(
  o: Partial<SceneNode>,
  props: Record<string, unknown>,
  w: unknown,
  h: unknown
): void {
  const flex = typeof props.flex === 'string' ? props.flex : 'col'
  o.layoutMode = parseAutoLayoutDirection(flex) ?? 'HORIZONTAL'
  const own = (dim: unknown) => (typeof dim === 'number' ? 'FIXED' : 'HUG')
  Object.assign(o, autoLayoutSizingFields(o.layoutMode, own(w), own(h)))
}

function applyLayoutAlignmentOverrides(
  props: Record<string, unknown>,
  o: Partial<SceneNode>
): void {
  const justify = designJSXProp(props, 'justify')
  if (typeof justify === 'string' && justify) {
    o.primaryAxisAlign = parsePrimaryAxisAlign(justify) ?? 'MIN'
  }
  const items = designJSXProp(props, 'items')
  if (typeof items === 'string' && items) {
    o.counterAxisAlign = parseCounterAxisAlign(items) ?? 'MIN'
  }
}

function shouldEnableAutoLayout(props: Record<string, unknown>, isText: boolean): boolean {
  if (props.flex !== undefined) return true
  if (!isText && hasAutoLayoutTriggerProps(props)) return true
  return false
}

function applyLayoutOverrides(
  props: Record<string, unknown>,
  o: Partial<SceneNode>,
  w: unknown,
  h: unknown,
  isText: boolean,
  parentLayout: SceneNode['layoutMode']
): void {
  if (props.grid) {
    applyGridOverrides(props, o, w, h)
    applyPaddingOverrides(props, o)
    const grow = layoutFactorProp(props.grow)
    if (grow !== undefined) o.layoutGrow = grow
    return
  }

  if (parentLayout === 'GRID') {
    applyGridChildOverrides(props, o)
  }

  if (shouldEnableAutoLayout(props, isText)) {
    applyAutoLayoutSizing(o, props, w, h)
  }

  o.layoutDirection =
    parseDirection(props.flow ?? (!isText ? props.dir : undefined)) ?? o.layoutDirection

  const gap = layoutSpacingProp(props.gap)
  if (gap !== undefined) o.itemSpacing = gap

  if (props.wrap) {
    o.layoutWrap = 'WRAP'
    const rowGap = layoutSpacingProp(props.rowGap)
    if (rowGap !== undefined) o.counterAxisSpacing = rowGap
  }

  applyLayoutAlignmentOverrides(props, o)

  applyPaddingOverrides(props, o)

  const grow = layoutFactorProp(props.grow)
  if (grow !== undefined) o.layoutGrow = grow
}

function applyTextStyleOverrides(props: Record<string, unknown>, o: Partial<SceneNode>): void {
  const fontSize = fontSizeProp(designJSXProp(props, 'size'))
  if (fontSize !== undefined) o.fontSize = fontSize

  const fontFamily = designJSXProp(props, 'font')
  if (typeof fontFamily === 'string') o.fontFamily = fontFamily

  const weight = designJSXProp(props, 'weight')
  if (typeof props.italic === 'boolean') o.italic = props.italic

  if (typeof weight === 'number') {
    o.fontWeight = weight
  } else if (typeof weight === 'string') {
    o.fontWeight = WEIGHT_MAP[weight] ?? 400
  }

  if (typeof props.color === 'string' || isColor(props.color)) {
    o.fills = [colorToFill(props.color)]
  }

  // A value it cannot read is left out, so the text keeps its own.
  const lineHeight = props.lineHeight === AUTO ? null : textLengthProp(props.lineHeight)
  if (lineHeight !== undefined) o.lineHeight = lineHeight
  const letterSpacing = textLengthProp(props.letterSpacing)
  if (letterSpacing) o.letterSpacing = letterSpacing
  const textDecoration = TEXT_DECORATION.parse(props.textDecoration)
  if (textDecoration) o.textDecoration = textDecoration
  applyTextDetailOverrides(props, o)
  const textCase = TEXT_CASE.parse(props.textCase)
  if (textCase) o.textCase = textCase
  if (props.maxLines !== undefined) {
    o.maxLines = props.maxLines as number
    o.textTruncation = 'ENDING'
  }
  if (props.truncate) {
    o.textTruncation = 'ENDING'
  }

  applyTextAlignmentOverrides(props, o)
}

function applyTextAlignmentOverrides(props: Record<string, unknown>, o: Partial<SceneNode>): void {
  const textAlign = designJSXProp(props, 'textAlign')
  if (typeof textAlign === 'string') {
    o.textAlignHorizontal = TEXT_ALIGN.parse(textAlign) ?? 'LEFT'
  }

  const textAlignVertical = designJSXProp(props, 'textAlignVertical')
  if (typeof textAlignVertical === 'string') {
    o.textAlignVertical = TEXT_ALIGN_VERTICAL.parse(textAlignVertical) ?? 'TOP'
  }
}

function applyTextAutoResize(
  props: Record<string, unknown>,
  o: Partial<SceneNode>,
  parentLayout: SceneNode['layoutMode']
): void {
  const w = designJSXProp(props, 'w')
  const hasExplicitWidth = w !== undefined
  const fillsParent = w === 'fill' || (props.grow as number) > 0
  const isInsideAutoLayout = parentLayout !== 'NONE'

  // DO NOT CHANGE these defaults without testing headless layout (no CanvasKit).
  // WIDTH_AND_HEIGHT relies on MeasureFunc — without it, text keeps the 100×100
  // default SceneNode size and blows up every HUG container. layout.ts has a
  // fallback estimator, but changing this logic can silently break all JSX rendering.
  if (props.textAutoResize) {
    o.textAutoResize = TEXT_AUTO_RESIZE.parse(props.textAutoResize) ?? 'NONE'
  } else if (hasExplicitWidth || (isInsideAutoLayout && fillsParent)) {
    o.textAutoResize = 'HEIGHT'
  } else {
    o.textAutoResize = 'WIDTH_AND_HEIGHT'
  }
}

function applyTextOverrides(
  props: Record<string, unknown>,
  o: Partial<SceneNode>,
  parentLayout: SceneNode['layoutMode']
): void {
  applyTextStyleOverrides(props, o)
  o.textDirection = parseDirection(props.dir) ?? o.textDirection
  applyTextAutoResize(props, o, parentLayout)
}

const FULL_TURN_DEGREES = 360

function numberProp(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * An `<Ellipse>`'s arc from its props: angles in degrees, clockwise from three o'clock, as the
 * canvas draws arcs, and the hole as a share of the ellipse. Null when none is set.
 */
function arcOverride(props: Record<string, unknown>): ArcData | null {
  const start = numberProp(props.startAngle)
  const end = numberProp(props.endAngle)
  const innerRadius = shareOfShape(props.innerRadius)
  if (start === undefined && end === undefined && innerRadius === undefined) return null
  const startDegrees = start ?? 0
  return {
    startingAngle: (startDegrees * Math.PI) / 180,
    endingAngle: ((end ?? startDegrees + FULL_TURN_DEGREES) * Math.PI) / 180,
    innerRadius: innerRadius ?? 0
  }
}

/** The fields a shape element's own props set, by the layer it makes. */
export function shapeOverrides(
  nodeType: NodeType,
  props: Record<string, unknown>
): Partial<SceneNode> {
  const o: Partial<SceneNode> = {}
  if (nodeType === 'STAR' || nodeType === 'POLYGON') {
    const points = numberProp(props.pointCount) ?? numberProp(props.points)
    if (points !== undefined)
      o.pointCount = Math.min(MAX_POINT_COUNT, Math.max(1, Math.trunc(points)))
  }
  if (nodeType === 'STAR') {
    const innerRadius = shareOfShape(props.innerRadius)
    if (innerRadius !== undefined) o.starInnerRadius = innerRadius
  }
  if (nodeType === 'ELLIPSE') {
    const arc = arcOverride(props)
    if (arc) o.arcData = arc
  }
  return o
}

export function propsToOverrides(
  props: Record<string, unknown>,
  isText: boolean,
  parentLayout: SceneNode['layoutMode']
): Partial<SceneNode> {
  props = normalizeStyleProps(props)
  const o: Partial<SceneNode> = {}

  if (props.name) o.name = props.name as string

  const { w, h } = applySizeOverrides(props, o, parentLayout)
  applyVisualOverrides(props, o)
  applyLayoutOverrides(props, o, w, h, isText, parentLayout)
  if (isText) applyTextOverrides(props, o, parentLayout)
  applyEffectOverrides(props, o)
  applyStateOverrides(props, o)

  return o
}
