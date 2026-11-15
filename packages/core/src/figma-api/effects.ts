import type {
  BlurEffectNormal,
  BlurEffectProgressive,
  DropShadowEffect,
  Effect as PluginEffect,
  GlassEffect,
  InnerShadowEffect,
  NoiseEffect,
  TextureEffect
} from '@figma/plugin-typings/plugin-api-standalone'
import * as v from 'valibot'

import type { BlendMode, Effect, Fill, NoiseEffectParams } from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'
import { BLACK, UNSET_GLASS, UNSET_NOISE, UNSET_TEXTURE } from '@open-pencil/scene-graph/constants'
import type { Vector } from '@open-pencil/scene-graph/primitives'
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
const UNSUPPORTED_EFFECT_TYPES = new Set(['SHADER'])

// Figma rejects Infinity as well as NaN ("Number must be finite").
const finiteSchema = v.pipe(v.number(), v.finite())
const unitSchema = v.pipe(finiteSchema, v.minValue(0), v.maxValue(1))
const nonNegativeSchema = v.pipe(finiteSchema, v.minValue(0))
// Figma keeps a glass depth it is given outside 1 to 100 at the nearer end rather than refusing it.
const GLASS_DEPTH = { min: 1, max: 100 }
const glassDepthSchema = v.pipe(
  finiteSchema,
  v.transform((depth) => Math.min(Math.max(depth, GLASS_DEPTH.min), GLASS_DEPTH.max))
)

// Figma keeps a progressive blur's start radius above 100 at 100; its end radius has no limit.
const MAX_START_RADIUS = 100
const startRadiusSchema = v.pipe(
  nonNegativeSchema,
  v.transform((radius) => Math.min(radius, MAX_START_RADIUS))
)

// Figma keeps a grain size, and a texture's radius, above 100 at 100 rather than refusing it.
const GRAIN_MAX = 100
const grainSchema = v.pipe(
  nonNegativeSchema,
  v.transform((size) => Math.min(size, GRAIN_MAX))
)
const grainVectorSchema = v.optional(v.strictObject({ x: grainSchema, y: grainSchema }))

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

const blurEntries = {
  type: v.picklist(['LAYER_BLUR', 'BACKGROUND_BLUR']),
  radius: nonNegativeSchema,
  visible: v.boolean(),
  boundVariables: blurBindingsSchema
}

// A noise has no visible radius, yet only its radius binds, as on a blur (Figma 126).
const noiseEntries = {
  type: v.literal('NOISE'),
  visible: v.boolean(),
  boundVariables: blurBindingsSchema,
  noiseSize: grainSchema,
  noiseSizeVector: grainVectorSchema,
  color: colorSchema,
  density: unitSchema
}

const effectSchema = v.variant('type', [
  v.strictObject({
    type: v.literal('DROP_SHADOW'),
    ...shadowEntries,
    showShadowBehindNode: v.optional(v.boolean())
  }),
  v.strictObject({ type: v.literal('INNER_SHADOW'), ...shadowEntries }),
  v.variant('blurType', [
    v.strictObject({ ...blurEntries, blurType: v.optional(v.literal('NORMAL'), 'NORMAL') }),
    v.strictObject({
      ...blurEntries,
      blurType: v.literal('PROGRESSIVE'),
      startRadius: startRadiusSchema,
      startOffset: vectorSchema,
      endOffset: vectorSchema
    })
  ]),
  v.variant('noiseType', [
    v.strictObject({ ...noiseEntries, noiseType: v.literal('MONOTONE') }),
    v.strictObject({
      ...noiseEntries,
      noiseType: v.literal('DUOTONE'),
      secondaryColor: colorSchema
    }),
    v.strictObject({ ...noiseEntries, noiseType: v.literal('MULTITONE'), opacity: unitSchema })
  ]),
  v.strictObject({
    type: v.literal('TEXTURE'),
    visible: v.boolean(),
    radius: grainSchema,
    boundVariables: blurBindingsSchema,
    noiseSize: grainSchema,
    noiseSizeVector: grainVectorSchema,
    clipToShape: v.boolean()
  }),
  v.strictObject({
    type: v.literal('GLASS'),
    visible: v.boolean(),
    radius: nonNegativeSchema,
    boundVariables: blurBindingsSchema,
    refraction: unitSchema,
    depth: glassDepthSchema,
    lightAngle: finiteSchema,
    lightIntensity: unitSchema,
    dispersion: unitSchema
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

/** The effects OpenPencil models, in the shapes Figma's plugin typings give them. */
type ModelledPluginEffect =
  | DropShadowEffect
  | InnerShadowEffect
  | BlurEffectNormal
  | BlurEffectProgressive
  | GlassEffect
  | NoiseEffect
  | TextureEffect
  // Figma reads noise and texture back without the blend mode its typings give them.
  | Extract<FigmaEffect, { type: 'NOISE' | 'TEXTURE' }>

function isPluginShadow(
  effect: ModelledPluginEffect
): effect is DropShadowEffect | InnerShadowEffect {
  return effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW'
}

function modelledPluginEffect(
  method: string,
  effect: PluginEffect | FigmaEffect
): ModelledPluginEffect {
  if (
    effect.type === 'DROP_SHADOW' ||
    effect.type === 'INNER_SHADOW' ||
    effect.type === 'GLASS' ||
    effect.type === 'NOISE' ||
    effect.type === 'TEXTURE' ||
    effect.type === 'LAYER_BLUR' ||
    effect.type === 'BACKGROUND_BLUR'
  ) {
    return effect
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
  effect: PluginEffect | FigmaEffect,
  bindings: (effect: ModelledPluginEffect) => FigmaEffectBindings
): FigmaEffect {
  const modelled = modelledPluginEffect(method, effect)
  // The copy owns its aliases, so changing them leaves the effect it was made from alone.
  const boundVariables = structuredClone(bindings(modelled))
  if (modelled.type === 'NOISE' || modelled.type === 'TEXTURE') {
    // Checked as `effects` checks it, then written back in Figma's field order.
    const { boundVariables: _previous, ...unbound } = modelled
    const [effect] = parseFigmaEffects([unbound])
    return toFigmaEffect(effect, boundVariables)
  }
  const { visible, radius } = modelled
  if (modelled.type === 'GLASS') {
    const { refraction, depth, lightAngle, lightIntensity, dispersion } = modelled
    return {
      type: 'GLASS',
      visible,
      radius,
      boundVariables,
      refraction,
      depth,
      lightAngle,
      lightIntensity,
      dispersion
    }
  }
  if (!isPluginShadow(modelled)) {
    if (modelled.blurType === 'PROGRESSIVE') {
      return {
        type: modelled.type,
        visible,
        radius,
        boundVariables,
        blurType: 'PROGRESSIVE',
        startRadius: modelled.startRadius,
        startOffset: { ...modelled.startOffset },
        endOffset: { ...modelled.endOffset }
      }
    }
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
  const effects = parseFigma(effectsSchema, value, method, 'effects')
  if (effects.filter((effect) => effect.type === 'GLASS').length > 1) {
    throw invalid(method, 'Only one glass effect is allowed per node.', 'effects')
  }
  const mismatch = grainSizeMismatch(value)
  if (mismatch) throw new Error(`in ${method}: ${mismatch}`)
  return firstTextureOnly(effects).map(toSceneEffect)
}

/**
 * Figma's complaint about an effect whose `noiseSize` is not its `noiseSizeVector.x`, read from
 * the values it was given, or null. The vector's `y` may differ: that is how a grain is not square.
 */
function grainSizeMismatch(value: unknown): string | null {
  const grain = v.object({ noiseSize: v.number(), noiseSizeVector: v.object({ x: v.number() }) })
  if (!Array.isArray(value)) return null
  for (const effect of value) {
    if (!v.is(grain, effect) || effect.noiseSize === effect.noiseSizeVector.x) continue
    return `Effect noiseSize (${effect.noiseSize}) does not match noiseSizeVector.x (${effect.noiseSizeVector.x}). Ensure these values are consistent.`
  }
  return null
}

/** `effects` with every texture after the first left out, as Figma silently keeps one. */
function firstTextureOnly(effects: FigmaEffect[]): FigmaEffect[] {
  const first = effects.findIndex((effect) => effect.type === 'TEXTURE')
  return effects.filter((effect, index) => effect.type !== 'TEXTURE' || index === first)
}

/** `value` as scene effects when it holds valid Figma effects, or null. */
export function tryParseFigmaEffects(value: unknown): Effect[] | null {
  if (unsupportedEffect(value)) return null
  const result = v.safeParse(effectsSchema, value)
  if (!result.success) return null
  if (result.output.filter((effect) => effect.type === 'GLASS').length > 1) return null
  if (grainSizeMismatch(value)) return null
  return firstTextureOnly(result.output).map(toSceneEffect)
}

/**
 * The fills a layer takes when it gains a glass effect: Figma turns a single fully opaque fill,
 * hidden or not, to 20% so the glass shows through, or to 10% when it is white. A layer that had a
 * glass effect already, hidden or not, keeps its fills, as does one with any other fills.
 */
export function fillsGainingGlass(
  before: readonly Effect[],
  after: readonly Effect[],
  fills: readonly Fill[]
): Fill[] | null {
  const hasGlass = (effects: readonly Effect[]) => effects.some(({ type }) => type === 'GLASS')
  if (hasGlass(before) || !hasGlass(after) || fills.length !== 1) return null
  const [fill] = fills
  if (fill.opacity !== 1) return null
  const white = fill.type === 'SOLID' && colorToHex(fill.color) === '#FFFFFF'
  return [{ ...fill, opacity: white ? 0.1 : 0.2 }]
}

/** A grain size as both axes, from the vector when given, else the one number. */
function grainSize(effect: { noiseSize: number; noiseSizeVector?: Vector }): Vector {
  return effect.noiseSizeVector
    ? { ...effect.noiseSizeVector }
    : { x: effect.noiseSize, y: effect.noiseSize }
}

function toSceneEffect(effect: FigmaEffect): Effect {
  if (effect.type === 'NOISE') {
    const noise: NoiseEffectParams = {
      noiseType: effect.noiseType,
      noiseSize: grainSize(effect),
      density: effect.density
    }
    if (effect.noiseType === 'DUOTONE') noise.secondaryColor = { ...effect.secondaryColor }
    if (effect.noiseType === 'MULTITONE') noise.opacity = effect.opacity
    // A `.fig` noise carries a radius of 4 that it does not use.
    return {
      type: 'NOISE',
      color: { ...effect.color },
      offset: { x: 0, y: 0 },
      radius: 4,
      spread: 0,
      visible: effect.visible,
      noise
    }
  }
  if (effect.type === 'TEXTURE') {
    return {
      type: 'TEXTURE',
      // A `.fig` texture carries an opaque black colour it does not use.
      color: { ...BLACK },
      offset: { x: 0, y: 0 },
      radius: effect.radius,
      spread: 0,
      visible: effect.visible,
      texture: { noiseSize: grainSize(effect), clipToShape: effect.clipToShape }
    }
  }
  if (effect.type === 'GLASS') {
    const { refraction, depth, lightAngle, lightIntensity, dispersion } = effect
    return {
      type: 'GLASS',
      // A `.fig` glass effect carries an opaque black colour it does not use.
      color: { ...BLACK },
      offset: { x: 0, y: 0 },
      radius: effect.radius,
      spread: 0,
      visible: effect.visible,
      glass: { refraction, depth, lightAngle, lightIntensity, dispersion }
    }
  }
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
    visible: effect.visible,
    ...(effect.blurType === 'PROGRESSIVE'
      ? {
          progressive: {
            startRadius: effect.startRadius,
            startOffset: { ...effect.startOffset },
            endOffset: { ...effect.endOffset }
          }
        }
      : {})
  }
}

/** The variables an effect's properties are bound to, as its `boundVariables` names them. */
export type FigmaEffectBindings = Partial<Record<EffectBindingProperty, FigmaVariableAlias>>

/**
 * A scene effect in the shape Figma's `effects` getter returns, with the variables its properties
 * are bound to.
 */
export function toFigmaEffect(effect: Effect, bindings: FigmaEffectBindings = {}): FigmaEffect {
  const radiusBinding = bindings.radius ? { radius: bindings.radius } : {}
  if (effect.type === 'NOISE') return figmaNoiseEffect(effect, radiusBinding)
  if (effect.type === 'TEXTURE') return figmaTextureEffect(effect, radiusBinding)
  if (effect.type === 'GLASS') {
    const glass = effect.glass ?? UNSET_GLASS
    return {
      type: 'GLASS',
      visible: effect.visible,
      radius: effect.radius,
      boundVariables: bindings.radius ? { radius: bindings.radius } : {},
      refraction: glass.refraction,
      depth: glass.depth,
      lightAngle: glass.lightAngle,
      lightIntensity: glass.lightIntensity,
      dispersion: glass.dispersion
    }
  }
  if (
    effect.type === 'LAYER_BLUR' ||
    effect.type === 'FOREGROUND_BLUR' ||
    effect.type === 'BACKGROUND_BLUR'
  ) {
    const blur = {
      // `.fig` files call a layer blur FOREGROUND_BLUR; the plugin API calls it LAYER_BLUR.
      type:
        effect.type === 'BACKGROUND_BLUR' ? ('BACKGROUND_BLUR' as const) : ('LAYER_BLUR' as const),
      visible: effect.visible,
      radius: effect.radius,
      boundVariables: bindings.radius ? { radius: bindings.radius } : {}
    }
    if (!effect.progressive) return { ...blur, blurType: 'NORMAL' }
    const { startRadius, startOffset, endOffset } = effect.progressive
    return {
      ...blur,
      blurType: 'PROGRESSIVE',
      startRadius,
      startOffset: { ...startOffset },
      endOffset: { ...endOffset }
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

/** A scene noise effect as Figma's `effects` getter returns it, each noise type with its field. */
function figmaNoiseEffect(effect: Effect, boundVariables: FigmaEffectBindings): FigmaEffect {
  const noise = effect.noise ?? UNSET_NOISE
  const base = {
    type: 'NOISE' as const,
    visible: effect.visible,
    boundVariables,
    noiseSize: noise.noiseSize.x,
    noiseSizeVector: { ...noise.noiseSize },
    color: { ...effect.color },
    density: noise.density
  }
  if (noise.noiseType === 'DUOTONE') {
    const secondaryColor = { ...(noise.secondaryColor ?? effect.color) }
    return { ...base, noiseType: 'DUOTONE', secondaryColor }
  }
  if (noise.noiseType === 'MULTITONE') {
    return { ...base, noiseType: 'MULTITONE', opacity: noise.opacity ?? 1 }
  }
  return { ...base, noiseType: 'MONOTONE' }
}

/** A scene texture effect as Figma's `effects` getter returns it. */
function figmaTextureEffect(effect: Effect, boundVariables: FigmaEffectBindings): FigmaEffect {
  const texture = effect.texture ?? UNSET_TEXTURE
  return {
    type: 'TEXTURE',
    visible: effect.visible,
    radius: effect.radius,
    boundVariables,
    noiseSize: texture.noiseSize.x,
    noiseSizeVector: { ...texture.noiseSize },
    clipToShape: texture.clipToShape
  }
}
