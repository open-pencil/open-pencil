import type { Vector } from '../primitives'
import type { LayerAnimation, SlideTransitionStyle } from './types'

/**
 * How a slide is drawn at a moment of a transition: moved by fractions of its own width and
 * height, faded, and darkened towards black.
 */
export interface SlideFrame {
  x: number
  y: number
  opacity: number
  /** How dark: 0 is the slide as it is, 1 black. */
  dim: number
}

/** The two slides of a transition, the one drawn first below the other. */
export interface TransitionFrames {
  from: SlideFrame
  to: SlideFrame
  /** Which slide is drawn on top. */
  above: 'from' | 'to'
}

/** How far the slide underneath moves in Slide in and Slide out, as Figma moves it. */
const PARALLAX = 0.25
/** How dark the slide underneath gets in Slide in and Slide out. */
const UNDERNEATH_DIM = 0.5

type Direction = readonly [number, number]
const RIGHTWARDS: Direction = [1, 0]
const LEFTWARDS: Direction = [-1, 0]
const DOWNWARDS: Direction = [0, 1]
const UPWARDS: Direction = [0, -1]

/**
 * The way a style moves its slides. A `FROM` side is the side the slide comes from. Figma's `OUT_TO`
 * names are mirrored: its panel shows SLIDE_OUT_TO_LEFT as → and plays it moving right.
 */
function directionOf(style: SlideTransitionStyle): Direction {
  if (style.endsWith('FROM_LEFT') || style.endsWith('OUT_TO_LEFT')) return RIGHTWARDS
  if (style.endsWith('FROM_RIGHT') || style.endsWith('OUT_TO_RIGHT')) return LEFTWARDS
  if (style.endsWith('FROM_TOP') || style.endsWith('OUT_TO_TOP')) return DOWNWARDS
  return UPWARDS
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** A direction scaled by `amount`, with no negative zero where the direction has no part. */
function along(direction: Direction, amount: number): Vector {
  return { x: direction[0] * amount || 0, y: direction[1] * amount || 0 }
}

function frame(direction: Direction, offset: number, dim = 0, opacity = 1): SlideFrame {
  return { ...along(direction, offset), opacity, dim: clamp01(dim) }
}

const STILL: SlideFrame = { x: 0, y: 0, opacity: 1, dim: 0 }

/**
 * Where the slides of a transition are when its easing is at `position`: 0 at the start, 1 at the
 * end, past 1 while a spring overshoots. Smart animate plays as Dissolve for now.
 */
export function transitionFrames(style: SlideTransitionStyle, position: number): TransitionFrames {
  const p = position
  if (style === 'NONE') return { from: STILL, to: STILL, above: 'to' }
  if (style === 'DISSOLVE' || style === 'SMART_ANIMATE')
    return { from: STILL, to: { ...STILL, opacity: clamp01(p) }, above: 'to' }
  const direction = directionOf(style)
  if (style.startsWith('PUSH_'))
    return { from: frame(direction, p), to: frame(direction, p - 1), above: 'to' }
  if (style.startsWith('MOVE_FROM_'))
    return { from: STILL, to: frame(direction, p - 1), above: 'to' }
  if (style.startsWith('MOVE_OUT_')) return { from: frame(direction, p), to: STILL, above: 'from' }
  if (style.startsWith('SLIDE_FROM_')) {
    return {
      from: frame(direction, PARALLAX * p, UNDERNEATH_DIM * p),
      to: frame(direction, p - 1),
      above: 'to'
    }
  }
  return {
    from: frame(direction, p),
    to: frame(direction, PARALLAX * (p - 1), UNDERNEATH_DIM * (1 - p)),
    above: 'from'
  }
}

/** How far, in slide pixels, a layer slides on or off, whatever its size, as in Figma. */
export const LAYER_SLIDE_DISTANCE = 300

/** Where a layer animating onto or off its slide is drawn, relative to where it is. */
export interface LayerFrame {
  x: number
  y: number
  opacity: number
}

const LAYER_DIRECTIONS: Record<Exclude<LayerAnimation['style'], 'FADE'>, Direction> = {
  SLIDE_FROM_LEFT: RIGHTWARDS,
  SLIDE_FROM_RIGHT: LEFTWARDS,
  SLIDE_FROM_TOP: DOWNWARDS,
  SLIDE_FROM_BOTTOM: UPWARDS
}

/**
 * Where an animating layer is when its easing is at `position`. A layer coming in fades in as it
 * slides the last stretch to its place; one going out keeps moving the same way as it fades.
 */
export function layerFrame(
  animation: Pick<LayerAnimation, 'style' | 'phase'>,
  position: number
): LayerFrame {
  const shown = animation.phase === 'IN' ? position : 1 - position
  const opacity = clamp01(shown)
  if (animation.style === 'FADE') return { x: 0, y: 0, opacity }
  const offset = LAYER_SLIDE_DISTANCE * (animation.phase === 'IN' ? position - 1 : position)
  return { ...along(LAYER_DIRECTIONS[animation.style], offset), opacity }
}

/** Where a layer is drawn before its step has played, or after. */
export function layerAtRest(animation: Pick<LayerAnimation, 'phase'>, played: boolean): LayerFrame {
  const shown = animation.phase === 'IN' ? played : !played
  return { x: 0, y: 0, opacity: shown ? 1 : 0 }
}

/** The transitions Figma's panel offers, each but the first three in four directions. */
export const SLIDE_TRANSITION_KINDS = [
  'NONE',
  'SMART_ANIMATE',
  'DISSOLVE',
  'PUSH',
  'SLIDE_IN',
  'SLIDE_OUT',
  'MOVE_IN',
  'MOVE_OUT'
] as const
export type SlideTransitionKind = (typeof SLIDE_TRANSITION_KINDS)[number]

/** Which way a transition or a layer moves, as Figma's arrows show it. */
export const MOTION_DIRECTIONS = ['LEFT', 'RIGHT', 'DOWN', 'UP'] as const
export type MotionDirection = (typeof MOTION_DIRECTIONS)[number]

/** The record names' prefix for each kind that moves. */
const KIND_PREFIXES = {
  PUSH: 'PUSH_FROM_',
  SLIDE_IN: 'SLIDE_FROM_',
  SLIDE_OUT: 'SLIDE_OUT_TO_',
  MOVE_IN: 'MOVE_FROM_',
  MOVE_OUT: 'MOVE_OUT_TO_'
} as const

/**
 * The side a record names for a way of moving: what moves rightwards comes from the left, and,
 * as Figma names them, an `OUT_TO_LEFT` moves rightwards too.
 */
const SIDES: Record<MotionDirection, 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM'> = {
  RIGHT: 'LEFT',
  LEFT: 'RIGHT',
  DOWN: 'TOP',
  UP: 'BOTTOM'
}

function directionName(direction: Direction): MotionDirection {
  if (direction[0] > 0) return 'RIGHT'
  if (direction[0] < 0) return 'LEFT'
  return direction[1] > 0 ? 'DOWN' : 'UP'
}

/** A style's kind, as Figma's panel lists it. */
export function transitionKind(style: SlideTransitionStyle): SlideTransitionKind {
  for (const [kind, prefix] of Object.entries(KIND_PREFIXES))
    if (style.startsWith(prefix)) return kind as SlideTransitionKind
  return style === 'NONE' || style === 'SMART_ANIMATE' ? style : 'DISSOLVE'
}

/** Which way a style moves its slides, or null for one that does not move them. */
export function transitionDirection(style: SlideTransitionStyle): MotionDirection | null {
  return transitionKind(style) in KIND_PREFIXES ? directionName(directionOf(style)) : null
}

/** The style of a kind moving `direction`; a kind that does not move ignores it. */
export function transitionStyle(
  kind: SlideTransitionKind,
  direction: MotionDirection
): SlideTransitionStyle {
  if (kind === 'NONE' || kind === 'SMART_ANIMATE' || kind === 'DISSOLVE') return kind
  return `${KIND_PREFIXES[kind]}${SIDES[direction]}` as SlideTransitionStyle
}

/** Which way a layer animation moves its layer, or null for a fade. */
export function layerAnimationDirection(style: LayerAnimation['style']): MotionDirection | null {
  return style === 'FADE' ? null : directionName(LAYER_DIRECTIONS[style])
}

/** The layer animation that slides its layer `direction`, or fades it with null. */
export function layerAnimationStyle(direction: MotionDirection | null): LayerAnimation['style'] {
  return direction ? `SLIDE_FROM_${SIDES[direction]}` : 'FADE'
}
