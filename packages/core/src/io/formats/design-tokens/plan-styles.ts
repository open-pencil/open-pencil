import { isEqual, isPlainObject } from 'es-toolkit/predicate'
import * as v from 'valibot'

import {
  getSharedStyles,
  type Color,
  type Effect,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import { tryParseFigmaEffects } from '#core/figma-api/effects'

import {
  decodeColor,
  decodeDimension,
  decodeFontFamily,
  decodeFontWeight,
  referencePath
} from './decode'
import type { AliasTarget, ImportSkip, ResolvedReference } from './plan'
import type { DesignTokenBundle, ReadToken } from './read'
import { isShadow, shadowTokenValue, typographyValue } from './styles'
import { OPENPENCIL_EXTENSION } from './types'

/** A text or effect style the import makes or updates. */
export interface PlannedStyle {
  kind: 'TEXT' | 'EFFECT'
  name: string
  /** The style updated, or null for one the import makes. */
  existingNodeId: string | null
  fields: Partial<SceneNode>
  /** Text style fields bound to variables. */
  bindings: Partial<Record<TextBindingField, AliasTarget>>
}

type TextBindingField = 'fontFamily' | 'fontSize' | 'letterSpacing' | 'lineHeight'
const TEXT_BINDING_FIELDS: readonly TextBindingField[] = [
  'fontFamily',
  'fontSize',
  'letterSpacing',
  'lineHeight'
]

const OwnTextSchema = v.object({
  text: v.object({
    fontFamily: v.string(),
    fontWeight: v.number(),
    italic: v.boolean(),
    fontSize: v.number(),
    lineHeight: v.nullable(v.number()),
    letterSpacing: v.number(),
    textDecoration: v.picklist(['NONE', 'UNDERLINE', 'STRIKETHROUGH']),
    textCase: v.picklist(['ORIGINAL', 'UPPER', 'LOWER', 'TITLE'])
  }),
  bindings: v.optional(v.record(v.string(), v.string()))
})
const OwnEffectsSchema = v.object({ effects: v.array(v.unknown()) })

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
  const own = v.safeParse(OwnTextSchema, token.extensions[OPENPENCIL_EXTENSION])
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
    lineHeight: multiplier !== null ? multiplier * fontSize : lineHeightPx,
    letterSpacing: fieldValue(value.letterSpacing, resolve, pixels) ?? 0
  }
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

/** One shadow of a shadow token, or the shadows a referenced shadow token holds. */
function shadowEffects(raw: unknown, resolve: Resolve, depth = 0): Effect[] | null {
  const path = referencePath(raw)
  if (path) {
    const resolved = depth < 16 ? resolve(path) : undefined
    return resolved?.kind === 'token' ? shadowList(resolved.token.value, resolve, depth + 1) : null
  }
  if (!isPlainObject(raw)) return null
  const color = fieldValue<Color>(raw.color, resolve, (value) =>
    isPlainObject(value) && typeof value.r === 'number' ? (value as Color) : decodeColor(value)
  )
  const length = (key: string) => fieldValue(raw[key], resolve, pixels) ?? 0
  if (!color) return null
  return [
    {
      type: raw.inset === true ? 'INNER_SHADOW' : 'DROP_SHADOW',
      color,
      offset: { x: length('offsetX'), y: length('offsetY') },
      radius: length('blur'),
      spread: length('spread'),
      visible: true,
      blendMode: 'NORMAL'
    }
  ]
}

function shadowList(value: unknown, resolve: Resolve, depth = 0): Effect[] | null {
  const entries = Array.isArray(value) ? value : [value]
  const effects: Effect[] = []
  for (const entry of entries) {
    const shadows = shadowEffects(entry, resolve, depth)
    if (!shadows) return null
    effects.push(...shadows)
  }
  return effects.length > 0 ? effects : null
}

/**
 * Shadows edited in another tool, in place of the visible shadows OpenPencil wrote. Effects
 * `$value` cannot hold, such as blurs and hidden shadows, keep their places; extra shadows go last.
 */
function replaceShadows(exact: readonly Effect[], shadows: readonly Effect[]): Effect[] {
  const queue = [...shadows]
  const effects = exact.flatMap((effect) => {
    if (!isShadow(effect) || !effect.visible) return [effect]
    const next = queue.shift()
    return next ? [next] : []
  })
  return [...effects, ...queue]
}

/** A shadow token as effects, preferring the exact effects OpenPencil wrote. */
function effectFields(token: ReadToken, resolve: Resolve): Partial<SceneNode> | null {
  const own = v.safeParse(OwnEffectsSchema, token.extensions[OPENPENCIL_EXTENSION])
  // Extension effects that do not read fall back to the token's own shadows.
  const exact = own.success ? tryParseFigmaEffects(own.output.effects) : null
  if (exact && isEqual(token.value, shadowTokenValue(exact))) return { effects: exact }
  const shadows = shadowList(token.value, resolve)
  if (!shadows) return null
  return { effects: exact ? replaceShadows(exact, shadows) : shadows }
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
    const fields = kind === 'TEXT' ? textFields(token, resolve) : effectFields(token, resolve)
    if (!fields) {
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
      fields,
      bindings: kind === 'TEXT' ? textBindings(token, alias) : {}
    })
  }
  return { styles, skipped }
}
