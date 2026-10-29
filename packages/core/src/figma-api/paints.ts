import * as v from 'valibot'

import type { BlendMode, Fill, GradientTransform, ImageScaleMode } from '@open-pencil/scene-graph'
import { BLACK } from '@open-pencil/scene-graph/constants'
import {
  gradientTransformRows,
  IDENTITY_GRADIENT_TRANSFORM
} from '@open-pencil/scene-graph/gradient'
import type { Color, Vector } from '@open-pencil/scene-graph/primitives'

import { invalid, received } from './accessors/text/messages'
import { BLEND_MODES, issuePath } from './effects'
import type { FigmaTransform } from './types'
import { variableAlias, type FigmaVariableAlias } from './variables/values'

/** The paint types Figma's `fills` and `strokes` take, in the order its message lists them. */
const PAINT_TYPES = [
  'SOLID',
  'SHADER',
  'GRADIENT_LINEAR',
  'GRADIENT_RADIAL',
  'GRADIENT_ANGULAR',
  'GRADIENT_DIAMOND',
  'IMAGE',
  'VIDEO'
] as const

/** Paint types Figma's plugin API takes that OpenPencil does not model yet. */
const UNSUPPORTED_PAINT_TYPES = new Set(['SHADER'])

const GRADIENT_TYPES = [
  'GRADIENT_LINEAR',
  'GRADIENT_RADIAL',
  'GRADIENT_ANGULAR',
  'GRADIENT_DIAMOND'
] as const

const SCALE_MODES = ['FILL', 'FIT', 'CROP', 'TILE'] as const satisfies readonly ImageScaleMode[]

type ImageFilters = Record<
  'exposure' | 'contrast' | 'saturation' | 'temperature' | 'tint' | 'highlights' | 'shadows',
  number
>

/** OpenPencil keeps no image filters; Figma reads every slider at 0 until one moves. */
const NO_FILTERS: ImageFilters = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0
}

/** Figma's videos are named by the SHA-1 of their bytes. */
const SHA1_HASH = /^[0-9a-f]{40}$/i

/** Figma's message for a value that is none of `options`. */
function invalidOption(options: readonly string[]): string {
  return `Invalid option: expected one of ${options.map((option) => `"${option}"`).join('|')}`
}

const unitSchema = v.pipe(v.number(), v.minValue(0), v.maxValue(1))
const aliasSchema = v.object({ type: v.literal('VARIABLE_ALIAS'), id: v.string() })
const colorBindingSchema = v.optional(v.strictObject({ color: v.optional(aliasSchema) }))

const paintEntries = {
  visible: v.optional(v.boolean()),
  opacity: v.optional(unitSchema),
  blendMode: v.optional(v.picklist(BLEND_MODES, invalidOption(BLEND_MODES)))
}

// Figma checks a transform's rows itself, after the paint's other fields.
const transformSchema = v.optional(v.unknown())

// Image filter sliders run from -1 to 1.
const filterSchema = v.optional(v.pipe(v.number(), v.minValue(-1), v.maxValue(1)))

const mediaEntries = {
  scaleMode: v.picklist(SCALE_MODES, invalidOption(SCALE_MODES)),
  scalingFactor: v.optional(v.number()),
  rotation: v.optional(v.number()),
  filters: v.optional(
    v.strictObject({
      exposure: filterSchema,
      contrast: filterSchema,
      saturation: filterSchema,
      temperature: filterSchema,
      tint: filterSchema,
      highlights: filterSchema,
      shadows: filterSchema
    })
  ),
  ...paintEntries
}

const paintSchema = v.variant('type', [
  v.strictObject({
    type: v.literal('SOLID'),
    // A solid colour is RGB; Figma takes an alpha as the paint's opacity.
    color: v.strictObject({
      r: unitSchema,
      g: unitSchema,
      b: unitSchema,
      a: v.optional(unitSchema)
    }),
    ...paintEntries,
    boundVariables: colorBindingSchema
  }),
  v.strictObject({
    type: v.picklist(GRADIENT_TYPES),
    gradientTransform: transformSchema,
    gradientStops: v.array(
      v.strictObject({
        position: unitSchema,
        color: v.strictObject({ r: unitSchema, g: unitSchema, b: unitSchema, a: unitSchema }),
        boundVariables: colorBindingSchema
      })
    ),
    ...paintEntries
  }),
  v.strictObject({
    type: v.literal('IMAGE'),
    imageHash: v.nullable(v.string()),
    imageTransform: transformSchema,
    ...mediaEntries
  }),
  v.strictObject({
    type: v.literal('VIDEO'),
    videoHash: v.nullable(v.string()),
    videoTransform: transformSchema,
    ...mediaEntries
  })
])

type ParsedPaint = v.InferOutput<typeof paintSchema>

type PaintBase = {
  readonly visible?: boolean
  readonly opacity?: number
  readonly blendMode?: BlendMode
}

type ColorBinding = { readonly boundVariables?: { readonly color?: FigmaVariableAlias } }

type MediaFields = PaintBase & {
  readonly scaleMode: ImageScaleMode
  readonly scalingFactor?: number
  readonly rotation?: number
  readonly filters?: Partial<ImageFilters>
}

/** A paint OpenPencil models that Figma's plugin API has no type for, read as the model holds it. */
export type OpenPencilPaint = Omit<Fill, 'type' | 'gradientTransform' | 'imageTransform'> & {
  readonly type: 'NOISE' | 'CUSTOM'
  readonly gradientTransform?: FigmaTransform
  readonly imageTransform?: FigmaTransform
}

/**
 * A paint as Figma's plugin API gives and takes it (`Paint` in `@figma/plugin-typings`): a solid
 * colour is RGB with its alpha in the opacity, transforms are two rows of three, and an image or
 * video names its scale mode, rotation, and tile scaling as Figma does. Like Figma, the setters
 * refuse a pattern; OpenPencil's own paints read as {@link OpenPencilPaint}.
 */
export type FigmaPaint =
  | (PaintBase &
      ColorBinding & {
        readonly type: 'SOLID'
        readonly color: Omit<Color, 'a'>
      })
  | (PaintBase & {
      readonly type: (typeof GRADIENT_TYPES)[number]
      readonly gradientTransform: FigmaTransform
      readonly gradientStops: ReadonlyArray<
        ColorBinding & { readonly position: number; readonly color: Color }
      >
    })
  | (MediaFields & {
      readonly type: 'IMAGE'
      readonly imageHash: string | null
      readonly imageTransform?: FigmaTransform
    })
  | (MediaFields & {
      readonly type: 'VIDEO'
      readonly videoHash: string | null
      readonly videoTransform?: FigmaTransform
    })
  | (PaintBase & {
      readonly type: 'PATTERN'
      readonly sourceNodeId: string
      readonly tileType: NonNullable<Fill['patternTileType']>
      readonly scalingFactor: number
      readonly spacing: Vector
      readonly horizontalAlignment: NonNullable<Fill['horizontalAlignment']>
    })
  | OpenPencilPaint

type ReadBase = Required<PaintBase>

/** What Figma calls the value each Valibot schema expects. */
const EXPECTED: Partial<Record<string, string>> = {
  strict_object: 'object',
  object: 'object',
  variant: 'object',
  array: 'array',
  number: 'number',
  string: 'string',
  boolean: 'boolean'
}

/** Where Figma reports an issue: a paint itself by its index, a field by its path. */
function where(path: readonly v.IssuePathItem[]): string {
  if (path.length === 0) return ''
  const [first] = path
  if (path.length === 1 && typeof first.key === 'number') return ` at index ${first.key}`
  return ` at ${issuePath(path)}`
}

/** One of Figma's lines for a Valibot issue, as its paint validation words it. */
function issueProblem(issue: v.BaseIssue<unknown>): string {
  const path = issue.path ?? []
  const last = path.at(-1)
  if (last?.origin === 'key') {
    if (issue.expected === 'never') {
      return `Unrecognized key: "${String(last.key)}"${where(path.slice(0, -1))}`
    }
    // Figma checks a missing field as undefined, which a choice refuses as an option.
    const problem = last.key === 'scaleMode' ? invalidOption(SCALE_MODES) : 'Required value missing'
    return `${problem}${where(path)}`
  }
  if (issue.type === 'picklist') return `${issue.message}${where(path)}`
  if (issue.type === 'max_value') {
    return `Too big: expected number to be <=${String(issue.requirement)}${where(path)}`
  }
  if (issue.type === 'min_value') {
    return `Too small: expected number to be >=${String(issue.requirement)}${where(path)}`
  }
  if (issue.input === undefined) return `Required value missing${where(path)}`
  const expected = EXPECTED[issue.type] ?? issue.expected ?? issue.type
  return `Expected ${expected}, received ${received(issue.input)}${where(path)}`
}

/** Figma's complaint about a paint type it does not take, or OpenPencil does not model. */
function typeProblem(value: readonly unknown[]): string | null {
  for (const [index, paint] of value.entries()) {
    if (!v.is(v.object({ type: v.unknown() }), paint)) continue
    const { type } = paint
    if (typeof type === 'string' && UNSUPPORTED_PAINT_TYPES.has(type)) {
      return `${type} paints are not supported at [${index}].type`
    }
    if (!(PAINT_TYPES as readonly unknown[]).includes(type)) {
      return `Expected [${index}].type to be one of the following: ${PAINT_TYPES.join(', ')}`
    }
  }
  return null
}

type TransformField = 'gradientTransform' | 'imageTransform' | 'videoTransform'

function isRow(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === 'number' && Number.isFinite(item))
  )
}

/** Figma's complaint about `value` as a transform, or null when it is two rows of three numbers. */
function transformProblem(value: unknown): string | null {
  if (value === undefined) return 'Required value missing'
  if (!Array.isArray(value))
    return `Expected array, received ${value === null ? 'null' : typeof value}`
  if (value.length < 2) return 'Too small: expected array to have exactly 2 items'
  if (value.length > 2) return 'Too big: expected array to have exactly 2 items'
  return value.every(isRow) ? null : 'Expected array of 3 numbers'
}

/** Where a paint at `index` in the list a script passes to `method` sets `property`. */
type PaintSite = { index: number; method: string; property: string }

/**
 * The scene transform `value` a paint holds in `field`, which Figma requires of a gradient. Figma
 * takes only two rows of three numbers and throws the way its `fills` and `strokes` setters do.
 */
function sceneTransform(
  value: unknown,
  field: TransformField,
  site: PaintSite
): GradientTransform | undefined {
  if (value === undefined && field !== 'gradientTransform') return undefined
  const problem = transformProblem(value)
  if (problem) {
    const at = `[${site.index}].${field}`
    throw invalid(
      site.method,
      `Expected ${at} to be one of the following, but none matched:\n  ${problem} at ${at}`,
      site.property
    )
  }
  const [[m00, m01, m02], [m10, m11, m12]] = value as FigmaTransform
  return { m00, m01, m02, m10, m11, m12 }
}

function sceneFill(paint: ParsedPaint, site: PaintSite): Fill {
  const base = {
    visible: paint.visible ?? true,
    opacity: paint.opacity ?? 1,
    ...(paint.blendMode && { blendMode: paint.blendMode })
  }
  if (paint.type === 'SOLID') {
    const { r, g, b, a } = paint.color
    // Figma keeps a solid paint's alpha in its opacity, so a colour's alpha stands in for an
    // opacity left out, as `figma.util.solidPaint` gives it.
    return { type: 'SOLID', ...base, color: { r, g, b, a: 1 }, opacity: paint.opacity ?? a ?? 1 }
  }
  if (paint.type === 'IMAGE' || paint.type === 'VIDEO') {
    const [hash, imageTransform] =
      paint.type === 'IMAGE'
        ? [paint.imageHash, sceneTransform(paint.imageTransform, 'imageTransform', site)]
        : [paint.videoHash, sceneTransform(paint.videoTransform, 'videoTransform', site)]
    return {
      type: paint.type,
      ...base,
      color: { ...BLACK },
      imageScaleMode: paint.scaleMode,
      ...(hash !== null && { imageHash: hash }),
      ...(imageTransform && { imageTransform }),
      ...(paint.rotation !== undefined && { imageRotation: paint.rotation }),
      ...(paint.scalingFactor !== undefined && { scale: paint.scalingFactor })
    }
  }
  return {
    type: paint.type,
    ...base,
    color: { ...BLACK },
    gradientStops: paint.gradientStops.map(({ position, color }) => ({
      position,
      color: { ...color }
    })),
    gradientTransform: sceneTransform(paint.gradientTransform, 'gradientTransform', site)
  }
}

/**
 * Check `value` against Figma's paint shapes and convert it to scene paints. Throws Figma's
 * message for `method` setting `property`, listing every problem on its own line.
 */
export function parseFigmaPaints(value: unknown, method = 'set_fills', property = 'fills'): Fill[] {
  if (!Array.isArray(value)) {
    throw invalid(method, `Expected array, received ${received(value)}`, property)
  }
  const unsupported = typeProblem(value)
  if (unsupported) throw invalid(method, unsupported, property)
  const result = v.safeParse(v.array(paintSchema), value)
  if (!result.success) throw invalid(method, result.issues.map(issueProblem).join('\n'), property)
  for (const paint of result.output) {
    if (paint.type === 'VIDEO' && paint.videoHash !== null && !SHA1_HASH.test(paint.videoHash)) {
      throw new Error(`in ${method}: Invalid SHA1 hash`)
    }
  }
  return result.output.map((paint, index) => sceneFill(paint, { index, method, property }))
}

function rows(transform: GradientTransform | undefined): FigmaTransform {
  return gradientTransformRows(transform ?? IDENTITY_GRADIENT_TRANSFORM)
}

/**
 * An image or video paint as Figma reads it. Outside crop mode it reads the identity transform, a
 * scaling factor of 1 unless tiled, and its rotation; a crop holds its own rotation, so it reads
 * none.
 */
function figmaMediaPaint(paint: Fill, type: 'IMAGE' | 'VIDEO', base: ReadBase): FigmaPaint {
  const scaleMode = paint.imageScaleMode ?? 'FILL'
  const crop = scaleMode === 'CROP'
  const media = {
    ...base,
    scaleMode,
    scalingFactor: scaleMode === 'TILE' ? (paint.scale ?? 1) : 1,
    ...(!crop && { rotation: paint.imageRotation ?? 0 }),
    filters: { ...NO_FILTERS }
  }
  const transform = rows(crop ? paint.imageTransform : undefined)
  const hash = paint.imageHash ?? null
  return type === 'IMAGE'
    ? { type, ...media, imageTransform: transform, imageHash: hash }
    : { type, ...media, videoTransform: transform, videoHash: hash }
}

function figmaPatternPaint(paint: Fill, base: ReadBase): FigmaPaint {
  return {
    type: 'PATTERN',
    ...base,
    sourceNodeId: paint.sourceNodeId ?? '',
    tileType: paint.patternTileType ?? 'RECTANGULAR',
    scalingFactor: paint.scale ?? 1,
    spacing: { ...(paint.patternSpacing ?? { x: 0, y: 0 }) },
    horizontalAlignment: paint.horizontalAlignment ?? 'START'
  }
}

function openPencilPaint(paint: Fill, type: OpenPencilPaint['type']): OpenPencilPaint {
  const { gradientTransform, imageTransform, ...rest } = paint
  return {
    ...structuredClone(rest),
    type,
    ...(gradientTransform && { gradientTransform: rows(gradientTransform) }),
    ...(imageTransform && { imageTransform: rows(imageTransform) })
  }
}

/** `paint` as Figma's plugin API reads it, its colour bound to `variableId` when given. */
export function toFigmaPaint(paint: Fill, variableId?: string): FigmaPaint {
  const base: ReadBase = {
    visible: paint.visible,
    opacity: paint.opacity,
    blendMode: paint.blendMode ?? 'NORMAL'
  }
  const { type } = paint
  if (type === 'SOLID') {
    const { r, g, b } = paint.color
    return {
      type,
      ...base,
      color: { r, g, b },
      boundVariables: variableId ? { color: variableAlias(variableId) } : {}
    }
  }
  if (type === 'IMAGE' || type === 'VIDEO') return figmaMediaPaint(paint, type, base)
  if (type === 'PATTERN') return figmaPatternPaint(paint, base)
  if (type === 'NOISE' || type === 'CUSTOM') return openPencilPaint(paint, type)
  return {
    type,
    ...base,
    gradientStops: (paint.gradientStops ?? []).map(({ position, color }) => ({
      position,
      color: { ...color }
    })),
    gradientTransform: rows(paint.gradientTransform)
  }
}
