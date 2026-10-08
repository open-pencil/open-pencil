import * as v from 'valibot'

import type { BlendMode, Effect } from '@open-pencil/scene-graph'

import { TRANSPARENT } from '#core/constants'

const BLEND_MODE_KEYS = {
  NORMAL: true,
  DARKEN: true,
  MULTIPLY: true,
  COLOR_BURN: true,
  LIGHTEN: true,
  SCREEN: true,
  COLOR_DODGE: true,
  OVERLAY: true,
  SOFT_LIGHT: true,
  HARD_LIGHT: true,
  DIFFERENCE: true,
  EXCLUSION: true,
  HUE: true,
  SATURATION: true,
  COLOR: true,
  LUMINOSITY: true,
  PASS_THROUGH: true
} satisfies Record<BlendMode, true>

const BLEND_MODES = Object.keys(BLEND_MODE_KEYS) as BlendMode[]

/** Effect kinds Figma's plugin API accepts that OpenPencil does not model yet. */
const UNSUPPORTED_EFFECT_TYPES = new Set(['NOISE', 'TEXTURE', 'GLASS', 'SHADER'])

// Figma rejects Infinity as well as NaN ("Number must be finite").
const finite = v.pipe(v.number(), v.finite())
const unit = v.pipe(finite, v.minValue(0), v.maxValue(1))
const nonNegative = v.pipe(finite, v.minValue(0))

const color = v.strictObject({ r: unit, g: unit, b: unit, a: unit })
const vector = v.strictObject({ x: finite, y: finite })
// Variable bindings on effects are not supported; Figma reports an empty object.
const boundVariables = v.optional(v.strictObject({}))

const shadowEntries = {
  color,
  offset: vector,
  radius: nonNegative,
  spread: v.optional(finite),
  visible: v.boolean(),
  blendMode: v.picklist(BLEND_MODES),
  boundVariables
}

const effectSchema = v.variant('type', [
  v.strictObject({
    type: v.literal('DROP_SHADOW'),
    ...shadowEntries,
    showShadowBehindNode: v.optional(v.boolean())
  }),
  v.strictObject({ type: v.literal('INNER_SHADOW'), ...shadowEntries }),
  v.strictObject({
    type: v.picklist(['LAYER_BLUR', 'BACKGROUND_BLUR']),
    radius: nonNegative,
    visible: v.boolean(),
    blurType: v.optional(v.literal('NORMAL'), 'NORMAL'),
    boundVariables
  })
])

const effectsSchema = v.array(effectSchema)

/** An effect as Figma's plugin API reads and writes it (`Effect` in `@figma/plugin-typings`). */
export type FigmaEffect = v.InferOutput<typeof effectSchema>

function issuePath(issue: v.BaseIssue<unknown>): string {
  return (issue.path ?? [])
    .map((item) => (typeof item.key === 'number' ? `[${item.key}]` : `.${String(item.key)}`))
    .join('')
}

function unsupportedEffect(value: unknown): string | null {
  if (!Array.isArray(value)) return null
  for (const [index, effect] of value.entries()) {
    const type: unknown = v.is(v.object({ type: v.unknown() }), effect) ? effect.type : undefined
    if (typeof type === 'string' && UNSUPPORTED_EFFECT_TYPES.has(type)) {
      return `${type} effects are not supported at [${index}].type`
    }
    if (v.is(v.object({ blurType: v.literal('PROGRESSIVE') }), effect)) {
      return `Progressive blur is not supported at [${index}].blurType`
    }
  }
  return null
}

/**
 * Check `value` against Figma's effect shapes and convert it to scene effects.
 * Throws with the first problem, as Figma's `effects` setter does.
 */
export function parseFigmaEffects(value: unknown): Effect[] {
  const unsupported = unsupportedEffect(value)
  if (unsupported) throw new Error(`Property "effects" failed validation: ${unsupported}`)
  const result = v.safeParse(effectsSchema, value)
  if (!result.success) {
    const [issue] = result.issues
    throw new Error(
      `Property "effects" failed validation: ${issue.message} at ${issuePath(issue) || 'effects'}`
    )
  }
  return result.output.map(toSceneEffect)
}

function toSceneEffect(effect: FigmaEffect): Effect {
  if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
    return {
      type: effect.type,
      color: { ...effect.color },
      offset: { ...effect.offset },
      radius: effect.radius,
      spread: effect.spread ?? 0,
      visible: effect.visible,
      // Figma accepts PASS_THROUGH on shadows but stores NORMAL; it is a layer blend mode.
      blendMode: effect.blendMode === 'PASS_THROUGH' ? 'NORMAL' : effect.blendMode,
      ...(effect.type === 'DROP_SHADOW' && effect.showShadowBehindNode !== undefined
        ? { showShadowBehindNode: effect.showShadowBehindNode }
        : {})
    }
  }
  return {
    type: effect.type,
    color: { ...TRANSPARENT },
    offset: { x: 0, y: 0 },
    radius: effect.radius,
    spread: 0,
    visible: effect.visible
  }
}

/** A scene effect in the shape Figma's `effects` getter returns. */
export function toFigmaEffect(effect: Effect): FigmaEffect {
  if (
    effect.type === 'LAYER_BLUR' ||
    effect.type === 'FOREGROUND_BLUR' ||
    effect.type === 'BACKGROUND_BLUR'
  ) {
    return {
      // `.fig` files call a layer blur FOREGROUND_BLUR; the plugin API calls it LAYER_BLUR.
      type: effect.type === 'BACKGROUND_BLUR' ? 'BACKGROUND_BLUR' : 'LAYER_BLUR',
      visible: effect.visible,
      radius: effect.radius,
      boundVariables: {},
      blurType: 'NORMAL'
    }
  }
  const shadow = {
    visible: effect.visible,
    radius: effect.radius,
    boundVariables: {},
    color: { ...effect.color },
    offset: { ...effect.offset },
    spread: effect.spread,
    blendMode: effect.blendMode ?? 'NORMAL'
  }
  return effect.type === 'DROP_SHADOW'
    ? {
        type: 'DROP_SHADOW',
        ...shadow,
        // The renderer draws the shadow behind the node unless this is `false`.
        showShadowBehindNode: effect.showShadowBehindNode ?? true
      }
    : { type: 'INNER_SHADOW', ...shadow }
}
