import * as v from 'valibot'

import { BEHAVIOUR_KINDS } from './kinds'

const BooleanBinding = v.object({
  propertyId: v.string(),
  /** For a variant property: the values that mean on and off. */
  on: v.optional(v.string()),
  off: v.optional(v.string())
})

const NumberSettings = v.object({
  min: v.number(),
  max: v.number(),
  step: v.number(),
  default: v.number()
})

/**
 * The variant property that draws interaction states, and the value that means each state.
 * A state without a value shows the rest value, or the instance's own when that is unset too.
 */
const InteractionStates = v.object({
  propertyId: v.string(),
  rest: v.optional(v.string()),
  hover: v.optional(v.string()),
  pressed: v.optional(v.string()),
  focus: v.optional(v.string()),
  disabled: v.optional(v.string())
})

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
