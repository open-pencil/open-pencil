import type { Easing } from '../types'

/** How a slide gives way to the next, by Figma's names for its slide transitions. */
export const SLIDE_TRANSITION_STYLES = [
  'NONE',
  'DISSOLVE',
  'SLIDE_FROM_LEFT',
  'SLIDE_FROM_RIGHT',
  'SLIDE_FROM_BOTTOM',
  'SLIDE_FROM_TOP',
  'PUSH_FROM_LEFT',
  'PUSH_FROM_RIGHT',
  'PUSH_FROM_BOTTOM',
  'PUSH_FROM_TOP',
  'MOVE_FROM_LEFT',
  'MOVE_FROM_RIGHT',
  'MOVE_FROM_TOP',
  'MOVE_FROM_BOTTOM',
  'SLIDE_OUT_TO_LEFT',
  'SLIDE_OUT_TO_RIGHT',
  'SLIDE_OUT_TO_TOP',
  'SLIDE_OUT_TO_BOTTOM',
  'MOVE_OUT_TO_LEFT',
  'MOVE_OUT_TO_RIGHT',
  'MOVE_OUT_TO_TOP',
  'MOVE_OUT_TO_BOTTOM',
  'SMART_ANIMATE'
] as const
export type SlideTransitionStyle = (typeof SLIDE_TRANSITION_STYLES)[number]

/** What moves the deck on from a slide: a click, or `delay` seconds passing. */
export type SlideTransitionTiming =
  | { type: 'ON_CLICK' }
  | {
      type: 'AFTER_DELAY'
      delay: number
      /** The TIMING variable the delay follows while it exists; `delay` is kept beside it. */
      delayVariableId?: string
    }

/**
 * How a deck moves on from a slide. It names no slide: the next one is the next in the grid. The
 * duration and easing may follow TIMING and EASING variables, keeping their values beside them
 * for when the variables are gone, as a behaviour's transition does.
 */
export interface SlideTransition {
  style: SlideTransitionStyle
  /** In seconds; a spring easing settles in its own time instead. */
  duration: number
  easing: Easing
  durationVariableId?: string
  easingVariableId?: string
  timing: SlideTransitionTiming
}

/** How a layer comes onto or leaves its slide, by Figma's names: a slide moves from that side. */
export const LAYER_ANIMATION_STYLES = [
  'FADE',
  'SLIDE_FROM_LEFT',
  'SLIDE_FROM_RIGHT',
  'SLIDE_FROM_TOP',
  'SLIDE_FROM_BOTTOM'
] as const
export type LayerAnimationStyle = (typeof LAYER_ANIMATION_STYLES)[number]

/**
 * A layer's animation on its slide: a step of the slide's build. Steps play in `order`; one that
 * plays `ON_CLICK` waits for the presenter, one that plays `AFTER_PREVIOUS` follows the step before
 * it. It lives on the layer so a copied layer or slide keeps it, and a layer has one at most, as in
 * Figma.
 */
export interface LayerAnimation {
  style: LayerAnimationStyle
  /** `IN` brings the layer on, so it is hidden until its step; `OUT` takes it away. */
  phase: 'IN' | 'OUT'
  trigger: 'ON_CLICK' | 'AFTER_PREVIOUS'
  /** In seconds. */
  duration: number
  easing: Easing
  durationVariableId?: string
  easingVariableId?: string
  /** Where the step plays among the slide's; ties play in layer order. */
  order: number
}

/** What a slide keeps besides its layers. */
export interface SlideSettings {
  /** Whether presenting passes the slide by; a skipped slide has no number either. */
  skipped: boolean
  /** The presenter's notes as plain text, a paragraph per line. */
  notes: string
  /** How the deck moves on from the slide, or null when it was never set. */
  transition: SlideTransition | null
}
