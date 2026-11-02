import { mapValues } from 'es-toolkit'
import * as v from 'valibot'

import { tryParseColor } from '@open-pencil/scene-graph/color'
import { STICKY_COLORS } from '@open-pencil/scene-graph/generated'
import type { Color } from '@open-pencil/scene-graph/primitives'

import {
  CONNECTOR_LINE,
  CONNECTOR_SIDE,
  enumProp,
  FIGJAM_TEXT_SIZE,
  FIGJAM_TYPEFACE,
  SHAPE_KIND,
  STROKE_ALIGN,
  STROKE_CAP,
  STROKE_JOIN
} from './enums'
import { isColor, isFillValue } from './overrides/fills'
import { isStrokeValue } from './overrides/strokes'
import { isLayerRef, type LayerRef } from './refs'
import { isVariable } from './variables'

/**
 * Parse a value a design JSX script passed, or throw `heading` followed by every problem and
 * where it is, as `v.summarize` lists them. Core words tool arguments the same way.
 */
export function parseScriptInput<S extends v.GenericSchema>(
  heading: string,
  schema: S,
  value: unknown
): v.InferOutput<S> {
  const result = v.safeParse(schema, value)
  if (result.success) return result.output
  throw new Error(`${heading}:\n${v.summarize(result.issues)}`)
}

/**
 * The layer props an element that draws its own layer takes, such as a connector's: the
 * renderer makes them into fields and variable bindings as it does for any layer.
 */
export const ownLayerPropsSchema = v.object({
  name: v.optional(v.string()),
  key: v.optional(v.unknown()),
  visible: v.optional(v.boolean()),
  opacity: v.optional(v.number())
})

/** `OwnLayerProps` and the props that place a layer in its parent, such as a sticky note's. */
export const placedOwnLayerPropsSchema = v.object({
  ...ownLayerPropsSchema.entries,
  x: v.optional(v.number()),
  y: v.optional(v.number()),
  position: v.optional(v.picklist(['absolute']))
})

/** A colour as a string, or as the colour a `designVar()` resolves to. */
export const colorPropSchema = v.union(
  [
    v.pipe(
      v.string(),
      v.rawTransform(({ dataset, addIssue, NEVER }): Color => {
        const color = tryParseColor(dataset.value)
        if (color) return color
        addIssue({ message: 'expected a colour' })
        return NEVER
      })
    ),
    v.custom<Color>(isColor)
  ],
  'expected a colour'
)

/** The props of an element read one at a time, each of them optional. */
export type ElementPropsSchema = v.ObjectSchema<v.ObjectEntries, undefined>

/**
 * The props `schema` takes, read from `props`: one that does not fit is left out as if it were
 * not set, since the renderer reports it (`elementPropWarnings`) and goes on.
 */
export function readElementProps<S extends ElementPropsSchema>(
  schema: S,
  props: Readonly<Record<string, unknown>>
): v.InferOutput<S> {
  const fitting = mapValues(schema.entries, (entry, key) =>
    v.is(entry, props[key]) ? props[key] : undefined
  )
  return v.parse(schema, fitting)
}

/** A value as a warning quotes it; one JSON cannot write, such as a BigInt inside it, by its brackets. */
function quoted(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`
  if (typeof value !== 'object' || value === null) return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return Array.isArray(value) ? '[…]' : '{…}'
  }
}

/** A warning for each prop `props` sets that does not fit `schema`, naming the element. */
export function elementPropWarnings(
  schema: ElementPropsSchema,
  props: Readonly<Record<string, unknown>>,
  element: string
): string[] {
  return Object.entries(schema.entries).flatMap(([key, entry]) => {
    const value = props[key]
    // A `designVar()` resolves to its value before the element reads it.
    if (value === undefined || isVariable(value)) return []
    const result = v.safeParse(entry, value)
    if (result.success) return []
    const [issue] = result.issues
    const source = `${key} ${quoted(value)} on <${element}> is ignored`
    // A reader of its own, such as an enum's, names what it takes.
    if (issue.kind === 'transformation') return [`Unknown ${source}; ${issue.message}.`]
    // A choice of kinds names them; a single type or bound is Valibot's to name.
    if (issue.type === 'union' || issue.type === 'custom')
      return [`Invalid ${source}; ${issue.message}.`]
    return [`Invalid ${source}; expected ${issue.expected}.`]
  })
}

/** A layer of the same JSX by name or `ref()`, or a point in the connector's parent. */
const connectorEndSchema = v.union(
  [v.string(), v.custom<LayerRef>(isLayerRef), v.object({ x: v.number(), y: v.number() })],
  'expected a layer name, a ref(), or { x, y }'
)

/** The props `<Connector>` takes: its own, and the layer props that style its line. */
export const connectorPropsSchema = v.object({
  from: v.optional(connectorEndSchema),
  to: v.optional(connectorEndSchema),
  fromSide: v.optional(enumProp(CONNECTOR_SIDE)),
  toSide: v.optional(enumProp(CONNECTOR_SIDE)),
  line: v.optional(enumProp(CONNECTOR_LINE)),
  startCap: v.optional(enumProp(STROKE_CAP)),
  endCap: v.optional(enumProp(STROKE_CAP)),
  ...ownLayerPropsSchema.entries,
  stroke: v.optional(colorPropSchema),
  strokeWidth: v.optional(v.pipe(v.number(), v.gtValue(0))),
  dashPattern: v.optional(v.array(v.number()))
})

const sizeSchema = v.pipe(v.number(), v.gtValue(0))
const dashSchema = v.array(v.number())

/**
 * The layer props a shape has: its place, the size it is given, which it grows past to fit its
 * label, and its paint. The label is styled as FigJam styles it, and the shape lays it out.
 */
export const shapeLayerPropsSchema = v.object({
  ...placedOwnLayerPropsSchema.entries,
  w: v.optional(sizeSchema),
  h: v.optional(sizeSchema),
  rotate: v.optional(v.number()),
  rounded: v.optional(v.pipe(v.number(), v.minValue(0))),
  bg: v.optional(v.custom(isFillValue, 'expected a colour or a paint')),
  fills: v.optional(v.array(v.custom(isFillValue, 'expected a colour or a paint'))),
  stroke: v.optional(colorPropSchema),
  strokeWidth: v.optional(sizeSchema),
  strokeAlign: v.optional(enumProp(STROKE_ALIGN)),
  strokeDash: v.optional(dashSchema),
  strokes: v.optional(v.array(v.custom(isStrokeValue, 'expected a stroke'))),
  strokeCap: v.optional(enumProp(STROKE_CAP)),
  strokeJoin: v.optional(enumProp(STROKE_JOIN)),
  dashPattern: v.optional(dashSchema)
})

/**
 * The props `<Shape>` takes: its kind, whether it keeps its height and truncates its label as a
 * resized FigJam shape does, and the layer props a shape has.
 */
export const shapePropsSchema = v.object({
  kind: v.optional(enumProp(SHAPE_KIND)),
  truncate: v.optional(v.boolean()),
  textSize: v.optional(enumProp(FIGJAM_TEXT_SIZE)),
  typeface: v.optional(enumProp(FIGJAM_TYPEFACE)),
  ...shapeLayerPropsSchema.entries
})

type StickyColorName = keyof typeof STICKY_COLORS

function isStickyColorName(value: string): value is StickyColorName {
  return value in STICKY_COLORS
}

/** A palette name such as `"yellow"`, or any colour. */
const stickyColorSchema = v.pipe(
  v.string(),
  v.rawTransform(({ dataset, addIssue, NEVER }): Color => {
    const name = dataset.value
    if (isStickyColorName(name)) return { ...STICKY_COLORS[name] }
    const color = tryParseColor(name)
    if (color) return color
    addIssue({ message: `expected ${Object.keys(STICKY_COLORS).join(', ')}, or a colour` })
    return NEVER
  })
)

/** The props `<Sticky>` takes: its own, and the few layer props a note has. */
export const stickyPropsSchema = v.object({
  color: v.optional(stickyColorSchema),
  author: v.optional(v.string()),
  authorVisible: v.optional(v.boolean()),
  wide: v.optional(v.boolean()),
  textSize: v.optional(enumProp(FIGJAM_TEXT_SIZE)),
  typeface: v.optional(enumProp(FIGJAM_TYPEFACE)),
  scale: v.optional(v.pipe(v.number(), v.gtValue(0))),
  // A note takes the props that place it, but no size, fills, or layout.
  ...placedOwnLayerPropsSchema.entries
})
