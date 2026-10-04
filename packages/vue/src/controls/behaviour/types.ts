import type { BehaviourKind } from '@open-pencil/core/behaviours'

/** A component property a behaviour value can be bound to. */
export interface BehaviourPropertyOption {
  id: string
  name: string
  /** Variant values, for a variant property; booleans pick which of them mean on and off. */
  values: string[]
}

/** A boolean value of the behaviour: the variant or boolean property that holds it. */
export interface BehaviourBooleanControl {
  id: string
  type: 'boolean'
  required: boolean
  /** The bound property, if any. */
  propertyId: string | null
  /** For a variant property: the values meaning on and off. */
  on?: string
  off?: string
  options: BehaviourPropertyOption[]
}

/** A number value of the behaviour, which keeps its own range since Figma has no number property. */
export interface BehaviourNumberControl {
  id: string
  type: 'number'
  min: number
  max: number
  step: number
  default: number
}

export type BehaviourValueControl = BehaviourBooleanControl | BehaviourNumberControl

/** One part of the selected component's behaviour: the slot property that is that part. */
export interface BehaviourPartControl {
  id: string
  required: boolean
  /** The bound slot property, if any. */
  propertyId: string | null
  /** The component's slot properties. */
  options: BehaviourPropertyOption[]
}

export interface BehaviourControl {
  kind: BehaviourKind
  values: BehaviourValueControl[]
  parts: BehaviourPartControl[]
  /** Required values and parts that are still unbound. */
  missing: number
}
