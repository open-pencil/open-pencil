import * as v from 'valibot'

import type {
  BlendMode,
  ConnectorLineType,
  ConnectorMagnet,
  ConstraintType,
  MaskType,
  SceneNode,
  Stroke,
  StrokeCap,
  StrokeJoin,
  TextAutoResize,
  TextCase,
  TextDecoration,
  TextDecorationStyle,
  TextDirection
} from '@open-pencil/scene-graph'
import type { FigJamTextSize, FigJamTypeface } from '@open-pencil/scene-graph/figjam'
import {
  SHAPE_WITH_TEXT_TYPES,
  type ShapeWithTextType
} from '@open-pencil/scene-graph/shape-with-text'

/**
 * A Figma enum as design JSX spells it. Reading and writing come from one table, so whatever the
 * export writes reads back, and a value the table does not know is reported instead of reaching
 * the document.
 */
export interface JSXEnum<T extends string> {
  /** The value a spelling names, read case-insensitively, or undefined for none. */
  parse(value: unknown): T | undefined
  /** How the export spells a value. */
  print(value: T): string
  /** Every spelling it reads, aliases included. */
  readonly names: readonly string[]
}

/**
 * `spellings` names every value of the enum, which the type checks, and is what the export writes;
 * `aliases` are further spellings it only reads.
 */
export function jsxEnum<T extends string>(
  spellings: Readonly<Record<T, string>>,
  aliases: Readonly<Record<string, T>> = {}
): JSXEnum<T> {
  const entries = Object.entries(spellings) as [T, string][]
  const byName = new Map<string, T>(
    [...entries.map(([value, name]): [string, T] => [name, value]), ...Object.entries(aliases)].map(
      ([name, value]): [string, T] => [name.toLowerCase(), value]
    )
  )
  return {
    parse: (value) => (typeof value === 'string' ? byName.get(value.toLowerCase()) : undefined),
    print: (value) => spellings[value],
    names: [...entries.map(([, name]) => name), ...Object.keys(aliases)]
  }
}

/** A prop that takes one of the enum's spellings, read as the value it names. */
export function enumProp<T extends string>(values: JSXEnum<T>) {
  return v.pipe(
    v.string(),
    v.rawTransform(({ dataset, addIssue, NEVER }) => {
      const value = values.parse(dataset.value)
      if (value !== undefined) return value
      addIssue({ message: `expected ${values.names.join(', ')}` })
      return NEVER
    })
  )
}

/** An enum spelled by each value's lowercase name, as most of design JSX's enums are. */
function lowercaseEnum<T extends string>(
  values: readonly T[],
  aliases: Readonly<Record<string, T>> = {}
): JSXEnum<T> {
  const spellings = Object.fromEntries(values.map((value) => [value, value.toLowerCase()]))
  return jsxEnum(spellings as Record<T, string>, aliases)
}

export const STROKE_CAP = lowercaseEnum<StrokeCap>([
  'NONE',
  'ROUND',
  'SQUARE',
  'ARROW_LINES',
  'ARROW_EQUILATERAL',
  'TRIANGLE_FILLED',
  'DIAMOND_FILLED',
  'CIRCLE_FILLED'
])
export const STROKE_JOIN = lowercaseEnum<StrokeJoin>(['MITER', 'BEVEL', 'ROUND'])
export const STROKE_ALIGN = lowercaseEnum<Stroke['align']>(['INSIDE', 'CENTER', 'OUTSIDE'])
export const CONSTRAINT = lowercaseEnum<ConstraintType>([
  'MIN',
  'CENTER',
  'MAX',
  'STRETCH',
  'SCALE'
])
export const MASK_TYPE = lowercaseEnum<MaskType>(['ALPHA', 'LUMINANCE', 'VECTOR'])
export const BLEND_MODE = lowercaseEnum<BlendMode>([
  'NORMAL',
  'DARKEN',
  'MULTIPLY',
  'COLOR_BURN',
  'LIGHTEN',
  'SCREEN',
  'COLOR_DODGE',
  'OVERLAY',
  'SOFT_LIGHT',
  'HARD_LIGHT',
  'DIFFERENCE',
  'EXCLUSION',
  'HUE',
  'SATURATION',
  'COLOR',
  'LUMINOSITY',
  'PASS_THROUGH'
])
export const TEXT_ALIGN = lowercaseEnum<SceneNode['textAlignHorizontal']>(
  ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'],
  { left_align: 'LEFT', center_align: 'CENTER', right_align: 'RIGHT' }
)
export const TEXT_ALIGN_VERTICAL = lowercaseEnum<SceneNode['textAlignVertical']>([
  'TOP',
  'CENTER',
  'BOTTOM'
])
export const TEXT_AUTO_RESIZE = jsxEnum<TextAutoResize>({
  NONE: 'none',
  WIDTH_AND_HEIGHT: 'width',
  HEIGHT: 'height',
  TRUNCATE: 'truncate'
})
export const TEXT_DIRECTION = lowercaseEnum<TextDirection>(['AUTO', 'LTR', 'RTL'])
export const TEXT_DECORATION = lowercaseEnum<TextDecoration>(['NONE', 'UNDERLINE', 'STRIKETHROUGH'])
export const TEXT_DECORATION_STYLE = lowercaseEnum<TextDecorationStyle>(['SOLID', 'DOTTED', 'WAVY'])
export const TEXT_CASE = lowercaseEnum<TextCase>(['ORIGINAL', 'UPPER', 'LOWER', 'TITLE'])

export const FIGJAM_TEXT_SIZE = jsxEnum<FigJamTextSize>({
  small: 'small',
  medium: 'medium',
  large: 'large',
  extraLarge: 'extraLarge',
  huge: 'huge'
})
/** FigJam's typefaces, as its text menus name them. */
export const FIGJAM_TYPEFACE = jsxEnum<FigJamTypeface>({
  simple: 'simple',
  bookish: 'bookish',
  technical: 'technical',
  scribbled: 'scribbled'
})
/** The kinds a `<Shape>` draws, as FigJam names them: `rounded_rectangle`, `eng_database`. */
export const SHAPE_KIND = lowercaseEnum<ShapeWithTextType>(SHAPE_WITH_TEXT_TYPES)
export const CONNECTOR_LINE = lowercaseEnum<ConnectorLineType>(['ELBOWED', 'STRAIGHT', 'CURVED'])
/** The sides a `<Connector>` end attaches by; the other magnets come only from files. */
export const CONNECTOR_SIDE = lowercaseEnum<
  Extract<ConnectorMagnet, 'AUTO' | 'TOP' | 'RIGHT' | 'BOTTOM' | 'LEFT' | 'CENTER'>
>(['AUTO', 'TOP', 'RIGHT', 'BOTTOM', 'LEFT', 'CENTER'])

/**
 * The layer props whose values are one of an enum's spellings, for checking what JSX passes. An
 * element with a props schema, such as `<Connector>`, checks its enums by `enumProp` instead.
 */
export const ENUM_PROPS: Readonly<Partial<Record<string, JSXEnum<string>>>> = {
  strokeCap: STROKE_CAP,
  strokeJoin: STROKE_JOIN,
  strokeAlign: STROKE_ALIGN,
  mask: MASK_TYPE,
  blendMode: BLEND_MODE,
  textAlign: TEXT_ALIGN,
  textAlignVertical: TEXT_ALIGN_VERTICAL,
  textAutoResize: TEXT_AUTO_RESIZE,
  dir: TEXT_DIRECTION,
  textDecoration: TEXT_DECORATION,
  textDecorationStyle: TEXT_DECORATION_STYLE,
  textCase: TEXT_CASE
}
