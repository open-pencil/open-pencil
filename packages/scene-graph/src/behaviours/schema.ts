import * as v from 'valibot'

import { BEHAVIOUR_KINDS, type InteractionState } from './kinds'

const BooleanBinding = v.object({
  propertyId: v.string(),
  /** For a variant property: the values that mean on and off. */
  on: v.optional(v.string()),
  off: v.optional(v.string())
})

/** Whether a number value's range can be stepped through: `max` above `min`, a positive step. */
export function isNumberRange(settings: { min: number; max: number; step: number }): boolean {
  return settings.max > settings.min && settings.step > 0
}

const NumberSettings = v.pipe(
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

const InteractionStates = v.object({ propertyId: v.string(), ...interactionStateValues })

export const behaviourSchema = v.object({
  kind: v.picklist(BEHAVIOUR_KINDS),
  /** Boolean values, by value id, bound to component properties. */
  booleans: v.record(v.string(), BooleanBinding),
  /** Text values, by value id, bound to text properties. */
  texts: v.optional(v.record(v.string(), v.object({ propertyId: v.string() })), {}),
  /** Number values, by value id: the range the behaviour keeps itself. */
  numbers: v.record(v.string(), NumberSettings),
  /** Parts, by part id, bound to slot properties. */
  parts: v.record(v.string(), v.string()),
  states: v.optional(InteractionStates)
})

/** How a main component behaves as a control, as kept in its plugin data. */
export type Behaviour = v.InferOutput<typeof behaviourSchema>
export type BehaviourBooleanBinding = v.InferOutput<typeof BooleanBinding>
export type BehaviourNumberSettings = v.InferOutput<typeof NumberSettings>
export type BehaviourInteractionStates = v.InferOutput<typeof InteractionStates>
