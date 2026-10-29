import * as v from 'valibot'

import { BEHAVIOUR_KINDS, type InteractionState } from './kinds'

const booleanBindingSchema = v.object({
  propertyId: v.string(),
  /** For a variant property: the values that mean on and off. */
  on: v.optional(v.string()),
  off: v.optional(v.string())
})

/** Whether a number value's range can be stepped through: `max` above `min`, a positive step. */
export function isNumberRange(settings: { min: number; max: number; step: number }): boolean {
  return settings.max > settings.min && settings.step > 0
}

const numberSettingsSchema = v.pipe(
  v.object({
    min: v.pipe(v.number(), v.finite()),
    max: v.pipe(v.number(), v.finite()),
    step: v.pipe(v.number(), v.finite()),
    default: v.pipe(v.number(), v.finite())
  }),
  v.check(
    (settings) => isNumberRange(settings),
    'A number value needs max above min and a positive step'
  )
)

/** Each interaction state's variant value, by state; a state left out shows the rest value. */
export const interactionStateValues = {
  rest: v.optional(v.string()),
  hover: v.optional(v.string()),
  pressed: v.optional(v.string()),
  focus: v.optional(v.string()),
  disabled: v.optional(v.string())
} satisfies Record<InteractionState, unknown>

const interactionStatesSchema = v.object({ propertyId: v.string(), ...interactionStateValues })

export const behaviourSchema = v.object({
  kind: v.picklist(BEHAVIOUR_KINDS),
  /** Boolean values, by value id, bound to component properties. */
  booleans: v.record(v.string(), booleanBindingSchema),
  /** Text values, by value id, bound to text properties. */
  texts: v.optional(v.record(v.string(), v.object({ propertyId: v.string() })), {}),
  /** Number values, by value id: the range the behaviour keeps itself. */
  numbers: v.record(v.string(), numberSettingsSchema),
  /** Parts, by part id, bound to slot properties. */
  parts: v.record(v.string(), v.string()),
  states: v.optional(interactionStatesSchema)
})

/** How a main component behaves as a control, as kept in its plugin data. */
export type Behaviour = v.InferOutput<typeof behaviourSchema>
export type BehaviourBooleanBinding = v.InferOutput<typeof booleanBindingSchema>
export type BehaviourNumberSettings = v.InferOutput<typeof numberSettingsSchema>
export type BehaviourInteractionStates = v.InferOutput<typeof interactionStatesSchema>

/**
 * A behaviour as scripts, tools, and JSX write it: component properties and slots by name, not
 * by id. Values are boolean or text values by their contract id; numbers are a slider's or
 * number field's own range.
 */
export const behaviourSpecSchema = v.object({
  kind: v.picklist(BEHAVIOUR_KINDS),
  values: v.optional(
    v.record(
      v.string(),
      v.union([
        v.string(),
        v.object({ property: v.string(), on: v.optional(v.string()), off: v.optional(v.string()) })
      ])
    )
  ),
  numbers: v.optional(
    v.record(
      v.string(),
      v.object({
        min: v.optional(v.number()),
        max: v.optional(v.number()),
        step: v.optional(v.number()),
        default: v.optional(v.number())
      })
    )
  ),
  parts: v.optional(v.record(v.string(), v.string())),
  states: v.optional(
    v.union([v.string(), v.object({ property: v.string(), ...interactionStateValues })])
  )
})

export type BehaviourSpec = v.InferOutput<typeof behaviourSpecSchema>
