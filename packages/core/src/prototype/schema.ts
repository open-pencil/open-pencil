import * as v from 'valibot'

export const TRIGGERS = ['click', 'hover', 'press', 'after-delay', 'key'] as const
export const TRANSITION_TYPES = [
  'instant',
  'dissolve',
  'slide-in',
  'slide-out',
  'push',
  'move-in',
  'smart-animate'
] as const
export const DIRECTIONS = ['left', 'right', 'up', 'down'] as const
export const EASINGS = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'spring'] as const
export const OVERLAY_POSITIONS = ['center', 'top', 'bottom', 'left', 'right'] as const

export const transitionSchema = v.object({
  type: v.picklist(TRANSITION_TYPES),
  /** Where the incoming screen comes from (slide, push, move in). */
  direction: v.optional(v.picklist(DIRECTIONS), 'left'),
  /** Milliseconds, 0–5000. */
  duration: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(5000)), 300),
  easing: v.optional(v.picklist(EASINGS), 'ease-out')
})

export const triggerSchema = v.variant('type', [
  v.object({ type: v.picklist(['click', 'hover', 'press']) }),
  v.object({
    type: v.literal('after-delay'),
    delay: v.pipe(v.number(), v.minValue(0), v.maxValue(60000))
  }),
  v.object({ type: v.literal('key'), key: v.pipe(v.string(), v.minLength(1)) })
])

export const actionSchema = v.variant('type', [
  v.object({
    type: v.literal('navigate'),
    destination: v.pipe(v.string(), v.minLength(1)),
    transition: transitionSchema
  }),
  v.object({ type: v.literal('back'), transition: v.optional(transitionSchema) }),
  v.object({
    type: v.literal('overlay'),
    destination: v.pipe(v.string(), v.minLength(1)),
    position: v.optional(v.picklist(OVERLAY_POSITIONS), 'center'),
    /** Clicking outside the overlay closes it. */
    closeOnOutside: v.optional(v.boolean(), true),
    transition: transitionSchema
  }),
  v.object({ type: v.literal('close-overlay') }),
  v.object({ type: v.literal('scroll-to'), destination: v.pipe(v.string(), v.minLength(1)) }),
  v.object({ type: v.literal('open-url'), url: v.pipe(v.string(), v.url()) })
])

export const interactionSchema = v.object({ trigger: triggerSchema, action: actionSchema })
export const interactionListSchema = v.array(interactionSchema)

export const flowSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  start: v.pipe(v.string(), v.minLength(1))
})
export const flowListSchema = v.array(flowSchema)
