import type { Effect, Fill, GradientTransform, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { isIdentityGradientTransform } from '@open-pencil/scene-graph/gradient'

import { formatColor, formatShadow } from './helpers'
import { helperCall, plainValue, type HelperCall, type JSXProp, type JSXValue } from './value'

const GRADIENT_HELPERS: Partial<Record<Fill['type'], string>> = {
  GRADIENT_LINEAR: 'linearGradient',
  GRADIENT_RADIAL: 'radialGradient',
  GRADIENT_ANGULAR: 'angularGradient',
  GRADIENT_DIAMOND: 'diamondGradient'
}

function isIdentity(transform: GradientTransform | undefined): boolean {
  return !transform || isIdentityGradientTransform(transform)
}

/** Paints and effects imported from Figma often spell out the default blend mode. */
function blendMode(mode: Fill['blendMode']): Fill['blendMode'] {
  return mode === 'NORMAL' || mode === 'PASS_THROUGH' ? undefined : mode
}

type Options = Record<string, JSXValue | undefined>

/** Helper options with defaults left out, or `undefined` when none differ. */
function options(entries: Options): Options | undefined {
  return Object.values(entries).some((value) => value !== undefined) ? entries : undefined
}

function fillValue(fill: Fill): JSXValue {
  const visible = fill.visible ? undefined : false
  if (fill.type === 'SOLID') {
    const color = formatColor(fill.color, fill.color.a)
    const opacity = fill.opacity === fill.color.a ? undefined : fill.opacity
    return helperCall(
      'solid',
      color,
      options({ opacity, visible, blendMode: blendMode(fill.blendMode) })
    )
  }
  const helper = GRADIENT_HELPERS[fill.type]
  if (helper && fill.gradientStops) {
    const stops = fill.gradientStops.map((stop) => [
      formatColor(stop.color, stop.color.a),
      stop.position
    ])
    return helperCall(
      helper,
      stops,
      options({
        opacity: fill.opacity === 1 ? undefined : fill.opacity,
        visible,
        blendMode: blendMode(fill.blendMode),
        transform: isIdentity(fill.gradientTransform)
          ? undefined
          : plainValue(fill.gradientTransform)
      })
    )
  }
  // Image, pattern, and other paints have no helper; they render back from their fields.
  return plainValue(fill)
}

/** A single visible solid paint fits the `bg` or text `color` shorthand. */
function solidShorthand(fills: Fill[]): string | null {
  if (fills.length !== 1) return null
  const [fill] = fills
  if (fill.type !== 'SOLID' || !fill.visible || blendMode(fill.blendMode)) return null
  // The shorthand has one alpha; a fill whose opacity differs from its colour's needs `solid`.
  if (fill.opacity !== fill.color.a) return null
  return formatColor(fill.color, fill.color.a)
}

export function collectFillProps(node: SceneNode, props: JSXProp[]): void {
  if (node.fills.length === 0) return
  const shorthand = solidShorthand(node.fills)
  if (shorthand) props.push([node.type === 'TEXT' ? 'color' : 'bg', shorthand])
  else props.push(['fills', node.fills.map(fillValue)])
}

interface StrokeValue {
  [key: string]: JSXValue | undefined
  color: string
  /** Only when it differs from the colour's alpha, which the colour already carries. */
  opacity?: number
  weight?: number
  align?: string
  dash?: number[]
  cap?: string
  join?: string
  visible?: false
}

function strokeValue(stroke: Stroke): StrokeValue {
  return {
    color: formatColor(stroke.color, stroke.color.a),
    opacity: stroke.opacity === stroke.color.a ? undefined : stroke.opacity,
    weight: stroke.weight === 1 ? undefined : stroke.weight,
    align: stroke.align === 'INSIDE' ? undefined : stroke.align.toLowerCase(),
    dash: stroke.dashPattern && stroke.dashPattern.length > 0 ? [...stroke.dashPattern] : undefined,
    cap: stroke.cap?.toLowerCase(),
    join: stroke.join?.toLowerCase(),
    visible: stroke.visible ? undefined : false
  }
}

const STROKE_SHORTHAND: Record<string, string> = {
  color: 'stroke',
  weight: 'strokeWidth',
  align: 'strokeAlign',
  dash: 'strokeDash'
}

/** Node-level cap and join apply to strokes that do not set their own. */
const DEFAULT_STROKE_CAP = 'NONE'
const DEFAULT_STROKE_JOIN = 'MITER'

/**
 * The shorthand props describe one stroke, and `strokeCap`/`strokeJoin` also set the node's
 * cap and join; they fit only when the stroke agrees with the node on both.
 */
function fitsStrokeShorthand(node: SceneNode, stroke: StrokeValue): boolean {
  if (stroke.visible !== undefined || stroke.opacity !== undefined) return false
  const nodeCap = node.strokeCap.toLowerCase()
  const nodeJoin = node.strokeJoin.toLowerCase()
  return (stroke.cap ?? nodeCap) === nodeCap && (stroke.join ?? nodeJoin) === nodeJoin
}

export function collectStrokeProps(node: SceneNode, props: JSXProp[]): void {
  const strokes = node.strokes.map(strokeValue)
  const [only] = strokes
  const shorthand = strokes.length === 1 && fitsStrokeShorthand(node, only)
  if (shorthand) {
    for (const [key, value] of Object.entries(only)) {
      if (value !== undefined && key !== 'cap' && key !== 'join') {
        props.push([STROKE_SHORTHAND[key], value])
      }
    }
  } else if (strokes.length > 0) {
    props.push(['strokes', strokes])
  }
  if (node.strokeCap !== DEFAULT_STROKE_CAP) props.push(['strokeCap', node.strokeCap.toLowerCase()])
  if (node.strokeJoin !== DEFAULT_STROKE_JOIN) {
    props.push(['strokeJoin', node.strokeJoin.toLowerCase()])
  }
  if (node.dashPattern.length > 0) props.push(['dashPattern', [...node.dashPattern]])
  if (node.independentStrokeWeights) {
    props.push([
      'strokeWeights',
      {
        top: node.borderTopWeight,
        right: node.borderRightWeight,
        bottom: node.borderBottomWeight,
        left: node.borderLeftWeight
      }
    ])
  }
}

const EFFECT_HELPERS: Record<Effect['type'], string> = {
  DROP_SHADOW: 'dropShadow',
  INNER_SHADOW: 'innerShadow',
  LAYER_BLUR: 'layerBlur',
  BACKGROUND_BLUR: 'backgroundBlur',
  FOREGROUND_BLUR: 'foregroundBlur'
}

function effectValue(effect: Effect): HelperCall {
  const visible = effect.visible ? undefined : false
  if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
    return helperCall(
      EFFECT_HELPERS[effect.type],
      options({
        x: effect.offset.x,
        y: effect.offset.y,
        radius: effect.radius,
        spread: effect.spread === 0 ? undefined : effect.spread,
        color: formatColor(effect.color, effect.color.a),
        visible,
        blendMode: blendMode(effect.blendMode),
        showShadowBehindNode: effect.showShadowBehindNode
      })
    )
  }
  return helperCall(
    EFFECT_HELPERS[effect.type],
    visible === undefined ? effect.radius : { radius: effect.radius, visible }
  )
}

function plainDropShadow(effect: Effect): string | null {
  const plain =
    effect.type === 'DROP_SHADOW' &&
    effect.spread === 0 &&
    !blendMode(effect.blendMode) &&
    effect.showShadowBehindNode === undefined
  return plain ? formatShadow(effect) : null
}

/**
 * `shadow` and `blur` describe a plain drop shadow followed by a layer blur, each optional,
 * in the order the renderer appends them; anything else needs `effects`.
 */
function effectShorthand(effects: Effect[]): JSXProp[] | null {
  if (effects.some((effect) => !effect.visible)) return null
  const shadow = effects.length > 0 ? plainDropShadow(effects[0]) : null
  const rest = shadow ? effects.slice(1) : effects
  if (rest.length > 1 || rest.some((effect) => effect.type !== 'LAYER_BLUR')) return null
  const props: JSXProp[] = []
  if (shadow) props.push(['shadow', shadow])
  for (const blur of rest) props.push(['blur', blur.radius])
  return props
}

export function collectEffectProps(node: SceneNode, props: JSXProp[]): void {
  if (node.effects.length === 0) return
  props.push(...(effectShorthand(node.effects) ?? [['effects', node.effects.map(effectValue)]]))
}
