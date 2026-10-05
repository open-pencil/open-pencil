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

export const behaviourSchema = v.object({
  kind: v.picklist(BEHAVIOUR_KINDS),
  /** Boolean values, by value id, bound to component properties. */
  booleans: v.record(v.string(), BooleanBinding),
  /** Number values, by value id: the range the behaviour keeps itself. */
  numbers: v.record(v.string(), NumberSettings),
  /** Parts, by part id, bound to slot properties. */
  parts: v.record(v.string(), v.string())
})

/** How a main component behaves as a control, as kept in its plugin data. */
export type Behaviour = v.InferOutput<typeof behaviourSchema>
export type BehaviourBooleanBinding = v.InferOutput<typeof BooleanBinding>
export type BehaviourNumberSettings = v.InferOutput<typeof NumberSettings>
