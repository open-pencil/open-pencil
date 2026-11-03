import { isEqual, isPlainObject } from 'es-toolkit/predicate'
import * as v from 'valibot'

import type { Effect, SceneGraph, SceneNode, TextLength } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { getSharedStyles } from '@open-pencil/scene-graph/shared-styles'
import { percentLength, pixelLength, textLengthSchema } from '@open-pencil/scene-graph/text'
import { effectBindingField, effectBindingTarget } from '@open-pencil/scene-graph/variables'

import { tryParseFigmaEffects } from '#core/figma-api/effects'
import {
  decodeColor,
  decodeDimension,
  decodeFontFamily,
  decodeFontWeight,
  referencePath
} from '#core/io/formats/design-tokens/decode'
import { tokenReference } from '#core/io/formats/design-tokens/paths'
import type { DesignTokenBundle, ReadToken } from '#core/io/formats/design-tokens/read'
import {
  isShadow,
  SHADOW_TOKEN_FIELDS,
  shadowTokenValue,
  typographyValue
} from '#core/io/formats/design-tokens/styles'
import { OPENPENCIL_EXTENSION } from '#core/io/formats/design-tokens/types'

import type { AliasTarget, ImportSkip, ResolvedReference } from './'

/** A text or effect style the import makes or updates. */
export interface PlannedStyle {
  kind: 'TEXT' | 'EFFECT'
  name: string
  /** The style updated, or null for one the import makes. */
  existingNodeId: string | null
  fields: Partial<SceneNode>
  /** Fields bound to variables, such as `fontSize` or `effects/0/radius`. */
  bindings: Record<string, AliasTarget>
}

type TextBindingField = 'fontFamily' | 'fontSize' | 'letterSpacing' | 'lineHeight'
const TEXT_BINDING_FIELDS: readonly TextBindingField[] = [
  'fontFamily',
  'fontSize',
  'letterSpacing',
  'lineHeight'
]

const ownTextSchema = v.object({
  text: v.object({
    fontFamily: v.string(),
    fontWeight: v.number(),
    italic: v.boolean(),
    fontSize: v.number(),
    lineHeight: v.nullable(textLengthSchema),
    letterSpacing: textLengthSchema,
    textDecoration: v.picklist(['NONE', 'UNDERLINE', 'STRIKETHROUGH']),
    textCase: v.picklist(['ORIGINAL', 'UPPER', 'LOWER', 'TITLE'])
  }),
  bindings: v.optional(v.record(v.string(), v.string()))
})
const ownEffectsSchema = v.object({
  effects: v.optional(v.array(v.unknown())),
  bindings: v.optional(v.record(v.string(), v.string()))
})

/** The composite types that become styles. */
const STYLE_KINDS: Partial<Record<string, PlannedStyle['kind']>> = {
  typography: 'TEXT',
  shadow: 'EFFECT'
}

type Resolve = (path: readonly string[]) => ResolvedReference | undefined
type Alias = (path: readonly string[]) => AliasTarget | undefined

/** A field's value: its own, or what the token it references holds, decoded the same way. */
function fieldValue<T>(
  raw: unknown,
  resolve: Resolve,
  decode: (value: unknown) => T | null
): T | null {
  const path = referencePath(raw)
  if (!path) return decode(raw)
  const resolved = resolve(path)
  if (!resolved) return null
  return decode(resolved.kind === 'token' ? resolved.token.value : resolved.value)
}

const pixels = (value: unknown) =>
  typeof value === 'number' ? value : (decodeDimension(value)?.value ?? null)

/**
 * OpenPencil's own fields for a style token, while its `$value` still says what they would write.
 * Other tools keep extensions they do not read, so a `$value` edited there no longer matches, and
 * the edit wins over the exact fields.
 */
function ownText(token: ReadToken) {
  const own = v.safeParse(ownTextSchema, token.extensions[OPENPENCIL_EXTENSION])
  if (!own.success) return null
  const { text, bindings = {} } = own.output
  return { ...own.output, current: isEqual(token.value, typographyValue(text, bindings)) }
}

/** A typography token as text style fields, preferring the exact fields OpenPencil wrote. */
function textFields(token: ReadToken, resolve: Resolve): Partial<SceneNode> | null {
  const own = ownText(token)
  if (own?.current) return { ...own.text }
  const fields = decodedTextFields(token, resolve)
  // Italic, decoration, and case have no place in `$value`, so the extension's still apply.
  return fields && own ? { ...own.text, ...fields } : fields
}

/** A token's line height: a multiple of the font size follows it as a percent, pixels stay. */
function tokenLineHeight(multiplier: number | null, pixels: number | null): TextLength | null {
  if (multiplier !== null) return percentLength(multiplier * 100)
  return pixels === null ? null : pixelLength(pixels)
}

function decodedTextFields(token: ReadToken, resolve: Resolve): Partial<SceneNode> | null {
  if (!isPlainObject(token.value)) return null
  const value = token.value
  const fontFamily = fieldValue(value.fontFamily, resolve, decodeFontFamily)
  const fontSize = fieldValue(value.fontSize, resolve, pixels)
  if (fontFamily === null || fontSize === null) return null
  const multiplier = fieldValue(value.lineHeight, resolve, (raw) =>
    typeof raw === 'number' ? raw : null
  )
  const lineHeightPx = multiplier === null ? fieldValue(value.lineHeight, resolve, pixels) : null
  return {
    fontFamily,
    fontSize,
    fontWeight: fieldValue(value.fontWeight, resolve, decodeFontWeight) ?? 400,
    // A unitless line height is a multiple of the font size, which follows the size as a percent.
    lineHeight: tokenLineHeight(multiplier, lineHeightPx),
    letterSpacing: pixelLength(fieldValue(value.letterSpacing, resolve, pixels) ?? 0)
  }
}

/** A typography token as text style fields and the fields its references bind. */
function textStyle(
  token: ReadToken,
  resolve: Resolve,
  alias: Alias
): Pick<PlannedStyle, 'fields' | 'bindings'> | null {
  const fields = textFields(token, resolve)
  return fields && { fields, bindings: textBindings(token, alias) }
}

/** Text style fields bound to variables: OpenPencil's recorded bindings, or the token's references. */
function textBindings(token: ReadToken, alias: Alias): PlannedStyle['bindings'] {
  const own = ownText(token)
  let references: Record<string, unknown> = {}
  if (own?.current) references = own.bindings ?? {}
  else if (isPlainObject(token.value)) references = token.value
  const bindings: PlannedStyle['bindings'] = {}
  for (const field of TEXT_BINDING_FIELDS) {
    const path = referencePath(references[field])
    const target = path && alias(path)
    if (target) bindings[field] = target
  }
  return bindings
}

/** Shadows read from a token, each with the token paths its fields reference. */
type ReadShadows = { effects: Effect[]; references: Array<Record<string, string[]>> }

/** The token paths one shadow's fields reference, by the effect property they set. */
function shadowReferences(raw: Record<string, unknown>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(SHADOW_TOKEN_FIELDS).flatMap(([property, key]) => {
      const path = referencePath(raw[key])
      return path ? [[property, path]] : []
    })
  )
}

/**
 * One shadow of a shadow token, or the shadows a referenced shadow token holds; those reference a
 * whole shadow, not a variable, so they bind nothing.
 */
function shadowEffects(raw: unknown, resolve: Resolve, depth = 0): ReadShadows | null {
  const path = referencePath(raw)
  if (path) {
    const resolved = depth < 16 ? resolve(path) : undefined
    const shadows =
      resolved?.kind === 'token' ? shadowList(resolved.token.value, resolve, depth + 1) : null
    return shadows && { effects: shadows.effects, references: shadows.effects.map(() => ({})) }
  }
  if (!isPlainObject(raw)) return null
  const color = fieldValue<Color>(raw.color, resolve, (value) =>
    isPlainObject(value) && typeof value.r === 'number' ? (value as Color) : decodeColor(value)
  )
  // A missing length is 0; one that names a token which does not resolve makes the shadow invalid.
  const length = (key: string) =>
    raw[key] === undefined ? 0 : fieldValue(raw[key], resolve, pixels)
  const [offsetX, offsetY, radius, spread] = ['offsetX', 'offsetY', 'blur', 'spread'].map(length)
  if (!color || offsetX === null || offsetY === null || radius === null || spread === null)
    return null
  const effect: Effect = {
    type: raw.inset === true ? 'INNER_SHADOW' : 'DROP_SHADOW',
    color,
    offset: { x: offsetX, y: offsetY },
    radius,
    spread,
    visible: true,
    blendMode: 'NORMAL'
  }
  return { effects: [effect], references: [shadowReferences(raw)] }
}

function shadowList(value: unknown, resolve: Resolve, depth = 0): ReadShadows | null {
  const entries = Array.isArray(value) ? value : [value]
  const list: ReadShadows = { effects: [], references: [] }
  for (const entry of entries) {
    const shadows = shadowEffects(entry, resolve, depth)
    if (!shadows) return null
    list.effects.push(...shadows.effects)
    list.references.push(...shadows.references)
  }
  return list.effects.length > 0 ? list : null
}

/**
 * Shadows edited in another tool, in place of the visible shadows OpenPencil wrote. Effects
 * `$value` cannot hold, such as blurs and hidden shadows, keep their places; extra shadows go last.
 * Also gives the position each new shadow lands at, and each kept effect's new position.
 */
function replaceShadows(
  exact: readonly Effect[],
  shadows: readonly Effect[]
): { effects: Effect[]; positions: number[]; kept: Map<number, number> } {
  const queue = [...shadows]
  const effects: Effect[] = []
  const positions: number[] = []
  const kept = new Map<number, number>()
  for (const [index, effect] of exact.entries()) {
    if (isShadow(effect) && effect.visible) {
      const next = queue.shift()
      if (!next) continue
      positions.push(effects.length)
      effects.push(next)
    } else {
      kept.set(index, effects.length)
      effects.push(effect)
    }
  }
  for (const next of queue) {
    positions.push(effects.length)
    effects.push(next)
  }
  return { effects, positions, kept }
}

/** A shadow token as effect style fields and the fields its references bind. */
function effectStyle(
  token: ReadToken,
  resolve: Resolve,
  alias: Alias
): Pick<PlannedStyle, 'fields' | 'bindings'> | null {
  const own = v.safeParse(ownEffectsSchema, token.extensions[OPENPENCIL_EXTENSION])
  const ownBindings = own.success ? (own.output.bindings ?? {}) : {}
  // Extension effects that do not read fall back to the token's own shadows.
  const exact = own.success && own.output.effects ? tryParseFigmaEffects(own.output.effects) : null
  if (exact && isEqual(token.value, shadowTokenValue(exact, ownBindings))) {
    return { fields: { effects: exact }, bindings: aliasedBindings(ownBindings, alias) }
  }
  const shadows = shadowList(token.value, resolve)
  if (!shadows) return null
  const placed = exact
    ? replaceShadows(exact, shadows.effects)
    : { effects: shadows.effects, positions: shadows.effects.map((_, index) => index), kept: null }
  const references: Record<string, string> = {}
  // Effects `$value` cannot hold, such as a bound blur, keep the bindings OpenPencil recorded.
  for (const [field, reference] of Object.entries(ownBindings)) {
    const target = effectBindingTarget(field)
    const index = target && placed.kept?.get(target.index)
    if (target && index !== undefined && index !== null)
      references[effectBindingField(index, target.property)] = reference
  }
  shadows.references.forEach((paths, shadow) => {
    const index = placed.positions.at(shadow)
    if (index === undefined) return
    for (const [property, path] of Object.entries(paths)) {
      const field = `effects/${index}/${property}`
      if (effectBindingTarget(field)) references[field] = tokenReference(path)
    }
  })
  return { fields: { effects: placed.effects }, bindings: aliasedBindings(references, alias) }
}

/** Bound fields whose references name a variable, as alias targets. */
function aliasedBindings(
  references: Readonly<Record<string, string>>,
  alias: Alias
): PlannedStyle['bindings'] {
  const bindings: PlannedStyle['bindings'] = {}
  for (const [field, reference] of Object.entries(references)) {
    const path = referencePath(reference)
    const target = path && effectBindingTarget(field) && alias(path)
    if (target) bindings[field] = target
  }
  return bindings
}

/** Typography tokens as text styles and shadow tokens as effect styles, matched by name. */
export function planStyles(
  graph: SceneGraph,
  bundle: DesignTokenBundle,
  resolve: Resolve,
  alias: Alias
): { styles: PlannedStyle[]; skipped: ImportSkip[] } {
  const textStyles = getSharedStyles(graph, 'text')
  const effectStyles = getSharedStyles(graph, 'effect')
  const styles: PlannedStyle[] = []
  const skipped: ImportSkip[] = []
  for (const token of bundle.composites) {
    const kind = STYLE_KINDS[token.type ?? '']
    if (!kind) {
      skipped.push({ name: token.name, collection: undefined, reason: 'unsupported-type' })
      continue
    }
    const style =
      kind === 'TEXT' ? textStyle(token, resolve, alias) : effectStyle(token, resolve, alias)
    if (!style) {
      skipped.push({ name: token.name, collection: undefined, reason: 'invalid-value' })
      continue
    }
    const existing = (kind === 'TEXT' ? textStyles : effectStyles).find(
      (style) => style.name === token.name
    )
    styles.push({
      kind,
      name: token.name,
      existingNodeId: existing?.nodeId ?? null,
      ...style
    })
  }
  return { styles, skipped }
}
