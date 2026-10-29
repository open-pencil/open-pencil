import * as v from 'valibot'

/**
 * The `.pen` document as pen.dev writes it (schema 2.21), plus the older forms still found in
 * files: the object `stroke` of 2.8 and `icon_font` nodes. Properties typed `…OrVariable` hold a
 * `$name` reference in place of the value. Enumerated values stay strings so a value this reader
 * does not know falls back to the default instead of rejecting the document.
 */

const numSchema = v.union([v.number(), v.string()])
const boolSchema = v.union([v.boolean(), v.string()])
const strSchema = v.string()
const sidesSchema = v.looseObject({
  top: v.optional(numSchema),
  right: v.optional(numSchema),
  bottom: v.optional(numSchema),
  left: v.optional(numSchema)
})

const paintBase = {
  enabled: v.optional(boolSchema),
  blendMode: v.optional(strSchema)
}

const colorPaintSchema = v.looseObject({
  type: v.literal('color'),
  ...paintBase,
  color: strSchema
})

const gradientPaintSchema = v.looseObject({
  type: v.literal('gradient'),
  ...paintBase,
  gradientType: v.optional(strSchema),
  opacity: v.optional(numSchema),
  center: v.optional(v.looseObject({ x: v.optional(v.number()), y: v.optional(v.number()) })),
  size: v.optional(v.looseObject({ width: v.optional(numSchema), height: v.optional(numSchema) })),
  rotation: v.optional(numSchema),
  colors: v.optional(v.array(v.looseObject({ color: strSchema, position: numSchema })))
})

const imagePaintSchema = v.looseObject({
  type: v.literal('image'),
  ...paintBase,
  opacity: v.optional(numSchema),
  url: v.optional(strSchema),
  mode: v.optional(strSchema),
  transform: v.optional(
    v.tuple([v.number(), v.number(), v.number(), v.number(), v.number(), v.number()])
  )
})

/** Shader and mesh gradient paints, and any paint type this reader does not draw. */
const otherPaintSchema = v.looseObject({ type: strSchema, ...paintBase })

const paintSchema = v.union([
  strSchema,
  colorPaintSchema,
  gradientPaintSchema,
  imagePaintSchema,
  otherPaintSchema
])
const paintsSchema = v.union([paintSchema, v.array(paintSchema)])

/** The 2.8 stroke: one colour with its weight and placement in one object. */
const legacyStrokeSchema = v.looseObject({
  thickness: v.union([numSchema, sidesSchema]),
  fill: v.optional(strSchema),
  align: v.optional(strSchema),
  join: v.optional(strSchema),
  cap: v.optional(strSchema)
})

const effectSchema = v.looseObject({
  type: strSchema,
  enabled: v.optional(boolSchema),
  radius: v.optional(numSchema),
  shadowType: v.optional(strSchema),
  offset: v.optional(v.looseObject({ x: numSchema, y: numSchema })),
  blur: v.optional(numSchema),
  /** Written by older files; current pen.dev shadows have no spread. */
  spread: v.optional(numSchema),
  color: v.optional(strSchema),
  blendMode: v.optional(strSchema)
})

const sizeSchema = numSchema
const paddingSchema = v.union([
  numSchema,
  v.tuple([numSchema, numSchema]),
  v.tuple([numSchema, numSchema, numSchema, numSchema])
])
const cornerRadiusSchema = v.union([numSchema, v.array(numSchema)])

/** Every property a node, or an override of one, can carry. */
const nodeFields = {
  name: v.optional(strSchema),
  context: v.optional(strSchema),
  x: v.optional(v.number()),
  y: v.optional(v.number()),
  width: v.optional(sizeSchema),
  height: v.optional(sizeSchema),
  reusable: v.optional(v.boolean()),
  theme: v.optional(v.record(strSchema, strSchema)),
  enabled: v.optional(boolSchema),
  opacity: v.optional(numSchema),
  flipX: v.optional(boolSchema),
  flipY: v.optional(boolSchema),
  layoutPosition: v.optional(strSchema),
  rotation: v.optional(numSchema),

  fill: v.optional(paintsSchema),
  stroke: v.optional(v.union([paintsSchema, legacyStrokeSchema])),
  strokeWidth: v.optional(v.union([numSchema, sidesSchema])),
  strokeLinecap: v.optional(strSchema),
  strokeLinejoin: v.optional(strSchema),
  strokeAlignment: v.optional(strSchema),
  effect: v.optional(v.union([effectSchema, v.array(effectSchema)])),
  cornerRadius: v.optional(cornerRadiusSchema),

  layout: v.optional(strSchema),
  gap: v.optional(numSchema),
  layoutIncludeStroke: v.optional(v.boolean()),
  padding: v.optional(paddingSchema),
  justifyContent: v.optional(strSchema),
  alignItems: v.optional(strSchema),
  clip: v.optional(boolSchema),
  placeholder: v.optional(v.boolean()),
  slot: v.optional(v.union([v.literal(false), v.array(strSchema)])),

  innerRadius: v.optional(numSchema),
  startAngle: v.optional(numSchema),
  sweepAngle: v.optional(numSchema),
  polygonCount: v.optional(numSchema),
  geometry: v.optional(strSchema),
  fillRule: v.optional(strSchema),
  viewBox: v.optional(v.tuple([v.number(), v.number(), v.number(), v.number()])),

  content: v.optional(strSchema),
  textGrowth: v.optional(strSchema),
  fontFamily: v.optional(strSchema),
  fontSize: v.optional(numSchema),
  fontWeight: v.optional(numSchema),
  fontStyle: v.optional(strSchema),
  letterSpacing: v.optional(numSchema),
  lineHeight: v.optional(numSchema),
  textAlign: v.optional(strSchema),
  textAlignVertical: v.optional(strSchema),
  underline: v.optional(boolSchema),
  strikethrough: v.optional(boolSchema),
  href: v.optional(strSchema),

  library: v.optional(strSchema),
  icon: v.optional(strSchema),
  weight: v.optional(numSchema),
  iconFontName: v.optional(strSchema),
  iconFontFamily: v.optional(strSchema),

  ref: v.optional(strSchema)
}

export type NodeFields = v.InferOutput<v.ObjectSchema<typeof nodeFields, undefined>>

/** Properties an instance sets on one of its component's descendants, or a node replacing it. */
export interface PenOverride extends NodeFields {
  type?: string
  id?: string
  children?: PenNode[]
  descendants?: Record<string, PenOverride>
  [key: string]: unknown
}

export interface PenNode extends PenOverride {
  type: string
  id: string
}

const overrideSchema: v.GenericSchema<unknown, PenOverride> = v.looseObject({
  ...nodeFields,
  type: v.optional(strSchema),
  id: v.optional(strSchema),
  children: v.optional(v.array(v.lazy(() => nodeSchema))),
  descendants: v.optional(
    v.record(
      strSchema,
      v.lazy(() => overrideSchema)
    )
  )
})

const nodeSchema: v.GenericSchema<unknown, PenNode> = v.looseObject({
  ...nodeFields,
  type: strSchema,
  id: strSchema,
  children: v.optional(v.array(v.lazy(() => nodeSchema))),
  descendants: v.optional(v.record(strSchema, overrideSchema))
})

const variableScalarSchema = v.union([v.string(), v.number(), v.boolean()])

const variableSchema = v.looseObject({
  type: strSchema,
  value: v.union([
    variableScalarSchema,
    v.array(
      v.looseObject({
        value: variableScalarSchema,
        theme: v.optional(v.record(strSchema, strSchema))
      })
    )
  ])
})

export const penDocumentSchema = v.looseObject({
  version: v.optional(strSchema),
  themes: v.optional(v.record(strSchema, v.array(strSchema))),
  imports: v.optional(v.record(strSchema, strSchema)),
  variables: v.optional(v.record(strSchema, variableSchema)),
  children: v.array(nodeSchema)
})

export type PenDocument = v.InferOutput<typeof penDocumentSchema>
export type PenVariable = v.InferOutput<typeof variableSchema>
export type PenVariableScalar = v.InferOutput<typeof variableScalarSchema>
export type PenPaint = v.InferOutput<typeof paintSchema>
export type PenPaints = v.InferOutput<typeof paintsSchema>
export type PenGradientPaint = v.InferOutput<typeof gradientPaintSchema>
export type PenImagePaint = v.InferOutput<typeof imagePaintSchema>
export type PenLegacyStroke = v.InferOutput<typeof legacyStrokeSchema>
export type PenEffect = v.InferOutput<typeof effectSchema>
export type PenSides = v.InferOutput<typeof sidesSchema>
export type PenNumber = v.InferOutput<typeof numSchema>

export const penFileSchema = v.pipe(v.string(), v.parseJson(), penDocumentSchema)
