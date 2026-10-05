import type { BehaviourKind, InteractionState } from '@open-pencil/scene-graph'

import type { VariantDefinitionControl } from '#vue/controls/variants'

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
  options: VariantDefinitionControl[]
  /** Whether `createVariant` can add a variant property for it: only on a component set. */
  creatable: boolean
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

/** A text value of the behaviour: the text property that shows it. */
export interface BehaviourTextControl {
  id: string
  type: 'text'
  required: boolean
  /** The bound text property, if any. */
  propertyId: string | null
  options: VariantDefinitionControl[]
  /** Whether `createText` can add a text layer and property for it. */
  creatable: boolean
}

export type BehaviourValueControl =
  | BehaviourBooleanControl
  | BehaviourTextControl
  | BehaviourNumberControl

/** One part of the selected component's behaviour: the slot property that is that part. */
export interface BehaviourPartControl {
  id: string
  required: boolean
  /** The bound slot property, if any. */
  propertyId: string | null
  /** The component's slot properties. */
  options: VariantDefinitionControl[]
  /** Whether `createPart` can add a slot frame for it: only in a component, not a set. */
  creatable: boolean
}

/** The variant property that draws interaction states, and the value of each state. */
export interface BehaviourStatesControl {
  /** The bound variant property, if any. */
  propertyId: string | null
  values: Partial<Record<InteractionState, string>>
  /** The component's variant properties. */
  options: VariantDefinitionControl[]
}

export interface BehaviourControl {
  kind: BehaviourKind
  values: BehaviourValueControl[]
  parts: BehaviourPartControl[]
  states: BehaviourStatesControl
  /** Ids of required values and parts that are still unbound, in contract order. */
  missing: string[]
}
