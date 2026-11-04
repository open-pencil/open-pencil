import type {
  BlurEffectNormal,
  DropShadowEffect,
  Effect as PluginEffect,
  InnerShadowEffect
} from '@figma/plugin-typings/plugin-api-standalone'
import * as v from 'valibot'

import type { BlendMode, Effect } from '@open-pencil/scene-graph'
import type { EffectBindingProperty } from '@open-pencil/scene-graph/variables'

import { TRANSPARENT } from '#core/constants'
import { invalid, parseFigma } from '#core/figma-api/validation'
import type { FigmaVariableAlias } from '#core/figma-api/variables/values'

/** Blend modes in the order Figma lists them in its messages. */
const BLEND_MODE_KEYS = {
  PASS_THROUGH: true,
  NORMAL: true,
  DARKEN: true,
  MULTIPLY: true,
  LINEAR_BURN: true,
  COLOR_BURN: true,
  LIGHTEN: true,
  SCREEN: true,
  LINEAR_DODGE: true,
  COLOR_DODGE: true,
  OVERLAY: true,
  SOFT_LIGHT: true,
  HARD_LIGHT: true,
  DIFFERENCE: true,
  EXCLUSION: true,
  HUE: true,
  SATURATION: true,
  COLOR: true,
  LUMINOSITY: true
} satisfies Record<BlendMode, true>

export const BLEND_MODES = Object.keys(BLEND_MODE_KEYS) as BlendMode[]

/** Effect kinds Figma's plugin API accepts that OpenPencil does not model yet. */
const UNSUPPORTED_EFFECT_TYPES = new Set(['NOISE', 'TEXTURE', 'GLASS', 'SHADER'])

// Figma rejects Infinity as well as NaN ("Number must be finite").
const finiteSchema = v.pipe(v.number(), v.finite())
const unitSchema = v.pipe(finiteSchema, v.minValue(0), v.maxValue(1))
const nonNegativeSchema = v.pipe(finiteSchema, v.minValue(0))

const colorSchema = v.strictObject({ r: unitSchema, g: unitSchema, b: unitSchema, a: unitSchema })
const vectorSchema = v.strictObject({ x: finiteSchema, y: finiteSchema })
const aliasSchema = v.strictObject({ type: v.literal('VARIABLE_ALIAS'), id: v.string() })
const shadowBindingsSchema = v.optional(
  v.strictObject({
    color: v.optional(aliasSchema),
    radius: v.optional(aliasSchema),
    spread: v.optional(aliasSchema),
    offsetX: v.optional(aliasSchema),
    offsetY: v.optional(aliasSchema)
  })
)
const blurBindingsSchema = v.optional(v.strictObject({ radius: v.optional(aliasSchema) }))

const shadowEntries = {
  color: colorSchema,
  offset: vectorSchema,
  radius: nonNegativeSchema,
  spread: v.optional(finiteSchema),
  visible: v.boolean(),
  blendMode: v.picklist(BLEND_MODES),
  boundVariables: shadowBindingsSchema
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
    radius: nonNegativeSchema,
    visible: v.boolean(),
    blurType: v.optional(v.literal('NORMAL'), 'NORMAL'),
    boundVariables: blurBindingsSchema
  })
])

const effectsSchema = v.array(effectSchema)

/** An effect as Figma's plugin API reads and writes it (`Effect` in `@figma/plugin-typings`). */
export type FigmaEffect = v.InferOutput<typeof effectSchema>

/** Why OpenPencil cannot keep `effect`, and the field that says so, or null when it can. */
function unsupportedEffectReason(effect: unknown): { message: string; field: string } | null {
  const type: unknown = v.is(v.object({ type: v.unknown() }), effect) ? effect.type : undefined
  if (typeof type === 'string' && UNSUPPORTED_EFFECT_TYPES.has(type)) {
    return { message: `${type} effects are not supported`, field: 'type' }
  }
  if (v.is(v.object({ blurType: v.literal('PROGRESSIVE') }), effect)) {
    return { message: 'Progressive blur is not supported', field: 'blurType' }
  }
  return null
}

function unsupportedEffect(value: unknown): string | null {
  if (!Array.isArray(value)) return null
  for (const [index, effect] of value.entries()) {
    const reason = unsupportedEffectReason(effect)
    if (reason) return `${reason.message} at [${index}].${reason.field}`
  }
  return null
}

/** The shadows and plain blurs OpenPencil models, in the shapes Figma's plugin typings give them. */
type ModelledPluginEffect = DropShadowEffect | InnerShadowEffect | BlurEffectNormal

function isPluginShadow(
  effect: ModelledPluginEffect
): effect is DropShadowEffect | InnerShadowEffect {
  return effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW'
}

function modelledPluginEffect(method: string, effect: PluginEffect): ModelledPluginEffect {
  if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') return effect
  if (effect.type === 'LAYER_BLUR' || effect.type === 'BACKGROUND_BLUR') {
    if (effect.blurType !== 'PROGRESSIVE') return effect
  }
  const reason = unsupportedEffectReason(effect)
  throw new Error(`in ${method}: ${reason?.message ?? `${effect.type} effects are not supported`}`)
}

/**
 * `effect` with `bindings` as `setBoundVariableForEffect` returns it: fields in Figma's order, a
 * shadow's spread at 0. Effects OpenPencil does not model are refused, as `effects` refuses them.
 */
export function boundEffectCopy(
  method: string,
  effect: PluginEffect,
  bindings: (effect: ModelledPluginEffect) => FigmaEffectBindings
): FigmaEffect {
  const modelled = modelledPluginEffect(method, effect)
  // The copy owns its aliases, so changing them leaves the effect it was made from alone.
  const boundVariables = structuredClone(bindings(modelled))
  const { visible, radius } = modelled
  if (!isPluginShadow(modelled)) {
    return { type: modelled.type, visible, radius, boundVariables, blurType: 'NORMAL' }
  }
  const shadow = {
    visible,
    radius,
    boundVariables,
    color: { ...modelled.color },
    offset: { ...modelled.offset },
    spread: 0,
    blendMode: modelled.blendMode
  }
  if (modelled.type === 'INNER_SHADOW') return { type: modelled.type, ...shadow }
  return modelled.showShadowBehindNode === undefined
    ? { type: modelled.type, ...shadow }
    : { type: modelled.type, ...shadow, showShadowBehindNode: modelled.showShadowBehindNode }
}

/** Check `value` against Figma's effect shapes and convert it to scene effects. */
export function parseFigmaEffects(value: unknown): Effect[] {
  const method = 'set_effects'
  const unsupported = unsupportedEffect(value)
  if (unsupported) throw invalid(method, unsupported, 'effects')
  return parseFigma(effectsSchema, value, method, 'effects').map(toSceneEffect)
}

/** `value` as scene effects when it holds valid Figma effects, or null. */
export function tryParseFigmaEffects(value: unknown): Effect[] | null {
  if (unsupportedEffect(value)) return null
  const result = v.safeParse(effectsSchema, value)
  return result.success ? result.output.map(toSceneEffect) : null
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

/** The variables an effect's properties are bound to, as its `boundVariables` names them. */
export type FigmaEffectBindings = Partial<Record<EffectBindingProperty, FigmaVariableAlias>>

/**
 * A scene effect in the shape Figma's `effects` getter returns, with the variables its properties
 * are bound to.
 */
export function toFigmaEffect(effect: Effect, bindings: FigmaEffectBindings = {}): FigmaEffect {
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
      boundVariables: bindings.radius ? { radius: bindings.radius } : {},
      blurType: 'NORMAL'
    }
  }
  const shadow = {
    visible: effect.visible,
    radius: effect.radius,
    boundVariables: bindings,
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
