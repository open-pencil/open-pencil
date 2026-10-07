import * as v from 'valibot'

import {
  CODE_SYNTAX_PLATFORMS,
  ROOT_FONT_SIZE_PX,
  TOKEN_UNITS,
  VARIABLE_SCOPES,
  type Color,
  type CodeSyntaxPlatform,
  type TokenUnit,
  type VariableScope,
  type VariableType
} from '@open-pencil/scene-graph'
import { parseDisplayableColor } from '@open-pencil/scene-graph/color'
import { parseCSSNumber } from '@open-pencil/scene-graph/css'

import type { ReadToken } from './read'
import { OPENPENCIL_EXTENSION } from './types'

/** A `{group.token}` reference, as its path segments. */
export function referencePath(value: unknown): string[] | null {
  if (typeof value !== 'string' || !value.startsWith('{') || !value.endsWith('}')) return null
  const inner = value.slice(1, -1)
  return inner && !/[{}]/.test(inner) ? inner.split('.') : null
}

/** CSS Color 4 spaces DTCG names, as `color()` takes them. */
const PREDEFINED_SPACES = new Set([
  'srgb',
  'srgb-linear',
  'display-p3',
  'a98-rgb',
  'prophoto-rgb',
  'rec2020',
  'xyz-d65',
  'xyz-d50'
])
/** Spaces CSS writes as functions; HSL and HWB take percentages, as DTCG stores them. */
const FUNCTION_SPACES: Record<string, (components: string[]) => string> = {
  hsl: ([h, s, l]) => `hsl(${h} ${s}% ${l}%`,
  hwb: ([h, w, b]) => `hwb(${h} ${w}% ${b}%`,
  lab: (components) => `lab(${components.join(' ')}`,
  lch: (components) => `lch(${components.join(' ')}`,
  oklab: (components) => `oklab(${components.join(' ')}`,
  oklch: (components) => `oklch(${components.join(' ')}`
}

const ColorObjectSchema = v.object({
  colorSpace: v.string(),
  components: v.pipe(v.array(v.union([v.number(), v.literal('none')])), v.length(3)),
  alpha: v.optional(v.number()),
  hex: v.optional(v.string())
})

/**
 * A DTCG color in sRGB. The 2025.10 object form names its space; it is written as CSS and read
 * by culori, then mapped into sRGB. Earlier drafts wrote any CSS color string, which reads the
 * same way.
 */
export function decodeColor(value: unknown): Color | null {
  if (typeof value === 'string') return parseDisplayableColor(value)
  const parsed = v.safeParse(ColorObjectSchema, value)
  if (!parsed.success) return null
  const { colorSpace, components, alpha = 1, hex } = parsed.output
  const parts = components.map(String)
  const open = PREDEFINED_SPACES.has(colorSpace)
    ? `color(${colorSpace} ${parts.join(' ')}`
    : FUNCTION_SPACES[colorSpace]?.(parts)
  if (!open) return hex ? parseDisplayableColor(hex) : null
  return parseDisplayableColor(`${open} / ${alpha})`)
}

const DimensionSchema = v.object({ value: v.number(), unit: v.picklist(['px', 'rem']) })
const DurationSchema = v.object({ value: v.number(), unit: v.picklist(['ms', 's']) })

/** A length in canvas pixels and the unit it was written in. */
export function decodeDimension(value: unknown): { value: number; unit: TokenUnit } | null {
  const parsed = v.safeParse(DimensionSchema, value)
  if (parsed.success) {
    const { value: number, unit } = parsed.output
    return { value: unit === 'rem' ? number * ROOT_FONT_SIZE_PX : number, unit }
  }
  const px = typeof value === 'string' ? parseCSSNumber(value) : null
  if (px === null) return null
  return {
    value: px,
    unit: typeof value === 'string' && value.trim().endsWith('rem') ? 'rem' : 'px'
  }
}

/** Font weight keywords DTCG allows, by the weight they stand for. */
const FONT_WEIGHTS: Record<string, number> = {
  thin: 100,
  hairline: 100,
  'extra-light': 200,
  'ultra-light': 200,
  light: 300,
  normal: 400,
  regular: 400,
  book: 400,
  medium: 500,
  'semi-bold': 600,
  'demi-bold': 600,
  bold: 700,
  'extra-bold': 800,
  'ultra-bold': 800,
  black: 900,
  heavy: 900,
  'extra-black': 950,
  'ultra-black': 950
}

export function decodeFontWeight(value: unknown): number | null {
  if (typeof value === 'number') return value >= 1 && value <= 1000 ? value : null
  return typeof value === 'string' ? (FONT_WEIGHTS[value.toLowerCase()] ?? null) : null
}

/** The most preferred family of a single name or a fallback list. */
export function decodeFontFamily(value: unknown): string | null {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' && first.trim() ? first.trim() : null
}

const OwnFieldsSchema = v.object({
  unit: v.optional(v.picklist(TOKEN_UNITS)),
  expression: v.optional(v.string()),
  scopes: v.optional(v.array(v.picklist(VARIABLE_SCOPES))),
  codeSyntax: v.optional(v.record(v.picklist(CODE_SYNTAX_PLATFORMS), v.string())),
  hiddenFromPublishing: v.optional(v.boolean())
})
const FigmaAliasSchema = v.object({
  targetVariableName: v.optional(v.string()),
  targetVariableSetName: v.optional(v.string())
})

/** A value that is the variable's own, or one it points at in another token. */
export type DecodedValue =
  | { kind: 'literal'; value: Color | number | string | boolean }
  | { kind: 'alias'; path: readonly string[]; collection?: string; name?: string }

/** What a token makes of a variable. An alias without a type takes its target's. */
export interface DecodedVariable {
  type: VariableType | undefined
  value: DecodedValue
  unit?: TokenUnit
  expression?: string
  scopes?: VariableScope[]
  codeSyntax?: Partial<Record<CodeSyntaxPlatform, string>>
  hiddenFromPublishing?: boolean
  description?: string
  /**
   * Whether the token carries OpenPencil's own fields. Its unit, scopes, and code syntax then
   * replace a variable's, missing ones included; other tools' tokens leave them as they are.
   */
  own: boolean
}

/** Why a token does not become a variable. */
export type DecodeFailure = 'unsupported-type' | 'invalid-value'

function isFigmaBoolean(token: ReadToken): boolean {
  return token.extensions['com.figma.type'] === 'boolean'
}

/** A token's type as a variable type, or undefined for an alias that must take its target's. */
export function variableTypeOf(token: ReadToken): VariableType | DecodeFailure | undefined {
  switch (token.type) {
    case 'color':
      return 'COLOR'
    case 'dimension':
    case 'duration':
    case 'fontWeight':
      return 'FLOAT'
    case 'number':
      return isFigmaBoolean(token) ? 'BOOLEAN' : 'FLOAT'
    case 'boolean':
      return 'BOOLEAN'
    case 'fontFamily':
    case 'string':
      return 'STRING'
    case undefined:
      return referencePath(token.value) ? undefined : 'unsupported-type'
    default:
      return 'unsupported-type'
  }
}

type Literal = { value: Color | number | string | boolean; unit?: TokenUnit }

/** A `number` token's value, or a boolean Figma writes as a number or as `true`/`false`. */
function decodeNumber(token: ReadToken): Literal | null {
  const { value } = token
  if (isFigmaBoolean(token))
    return typeof value === 'boolean' || value === 0 || value === 1
      ? { value: Boolean(value) }
      : null
  return typeof value === 'number' && Number.isFinite(value) ? { value } : null
}

/**
 * A literal's value in the unit its variable keeps: a duration written in seconds, as Figma
 * requires, goes back into a variable that holds milliseconds.
 */
function valueInUnit(literal: Literal, unit: TokenUnit | undefined): Literal['value'] {
  const { value } = literal
  if (typeof value !== 'number') return value
  if (literal.unit === 's' && unit === 'ms') return Number((value * 1000).toPrecision(12))
  if (literal.unit === 'ms' && unit === 's') return Number((value / 1000).toPrecision(12))
  return value
}

/** A literal in the shape its type takes, with the unit it was written in. */
function decodeLiteral(token: ReadToken): Literal | null {
  const { value } = token
  switch (token.type) {
    case 'color': {
      const color = decodeColor(value)
      return color && { value: color }
    }
    case 'dimension':
      return decodeDimension(value)
    case 'duration': {
      const parsed = v.safeParse(DurationSchema, value)
      return parsed.success ? parsed.output : null
    }
    case 'fontWeight': {
      const weight = decodeFontWeight(value)
      return weight === null ? null : { value: weight }
    }
    case 'fontFamily': {
      const family = decodeFontFamily(value)
      return family === null ? null : { value: family }
    }
    case 'boolean':
      return typeof value === 'boolean' ? { value } : null
    case 'number':
      return decodeNumber(token)
    case 'string':
      return typeof value === 'string' ? { value } : null
    default:
      return null
  }
}

/** Scopes a token type implies when the token does not list its own. */
function impliedScopes(token: ReadToken): VariableScope[] | undefined {
  if (token.type === 'fontFamily') return ['FONT_FAMILY']
  if (token.type === 'fontWeight') return ['FONT_STYLE']
  return undefined
}

/** A token as a variable value and OpenPencil's own token fields. */
export function decodeVariableToken(token: ReadToken): DecodedVariable | DecodeFailure {
  const type = variableTypeOf(token)
  if (type === 'unsupported-type' || type === 'invalid-value') return type
  const own = v.safeParse(OwnFieldsSchema, token.extensions[OPENPENCIL_EXTENSION])
  const fields = own.success ? own.output : {}
  const reference = referencePath(token.value)
  let value: DecodedValue
  let unit = fields.unit
  if (reference) {
    const figma = v.safeParse(FigmaAliasSchema, token.extensions['com.figma.aliasData'])
    value = {
      kind: 'alias',
      path: reference,
      collection: figma.success ? figma.output.targetVariableSetName : undefined,
      name: figma.success ? figma.output.targetVariableName : undefined
    }
  } else {
    const literal = decodeLiteral(token)
    if (!literal) return 'invalid-value'
    unit ??= literal.unit === 'px' ? undefined : literal.unit
    value = { kind: 'literal', value: valueInUnit(literal, unit) }
  }
  return {
    type,
    value,
    unit: type === 'FLOAT' ? unit : undefined,
    expression: fields.expression,
    scopes: fields.scopes ?? impliedScopes(token),
    codeSyntax: fields.codeSyntax,
    hiddenFromPublishing: fields.hiddenFromPublishing,
    description: token.description,
    own: own.success
  }
}
