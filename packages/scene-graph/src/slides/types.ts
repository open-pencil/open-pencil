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

/** The easings Figma offers a slide transition. */
export const SLIDE_TRANSITION_CURVES = [
  'EASE_IN',
  'EASE_OUT',
  'EASE_IN_AND_OUT',
  'LINEAR',
  'GENTLE',
  'QUICK',
  'BOUNCY',
  'SLOW'
] as const
export type SlideTransitionCurve = (typeof SLIDE_TRANSITION_CURVES)[number]

/** What moves the deck on from a slide: a click, or `delay` seconds passing. */
export type SlideTransitionTiming = { type: 'ON_CLICK' } | { type: 'AFTER_DELAY'; delay: number }

/** How a deck moves on from a slide. It names no slide: the next one is the next in the grid. */
export interface SlideTransition {
  style: SlideTransitionStyle
  /** In seconds. */
  duration: number
  curve: SlideTransitionCurve
  timing: SlideTransitionTiming
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
