/** The controls a main component can behave as. */
export type BehaviourKind = 'switch' | 'checkbox' | 'slider' | 'tabs'

/**
 * How a behaviour value is held. A boolean is a variant or boolean property of the component.
 * Figma has no number property, so a number is the behaviour's own (min, max, step, default);
 * a choice is which item of a slot is active, the first by default.
 */
export type BehaviourValueType = 'boolean' | 'number' | 'choice'

/** A value of the control: its state, which preview reads and changes. */
export interface BehaviourValueContract {
  id: string
  type: BehaviourValueType
  /** Whether a boolean value must be bound before the behaviour is complete. */
  required: boolean
}

/**
 * A Reka UI subcomponent of the control, which is a slot of the component: the behaviour binds
 * it to one of the component's slot properties, never to a layer found by name.
 */
export interface BehaviourPartContract {
  id: string
  required: boolean
}

export interface BehaviourContract {
  kind: BehaviourKind
  values: BehaviourValueContract[]
  parts: BehaviourPartContract[]
}

/**
 * The behaviours OpenPencil knows, after Reka UI's primitives. Their states are drawn as the
 * component's variants and properties; their subcomponents (thumb, range, trigger, …) are the
 * component's slots, and the component itself is the control's root.
 */
export const BEHAVIOUR_CONTRACTS: readonly BehaviourContract[] = [
  {
    kind: 'switch',
    values: [
      { id: 'value', type: 'boolean', required: true },
      { id: 'disabled', type: 'boolean', required: false }
    ],
    parts: [{ id: 'thumb', required: false }]
  },
  {
    kind: 'checkbox',
    values: [
      { id: 'value', type: 'boolean', required: true },
      { id: 'disabled', type: 'boolean', required: false }
    ],
    parts: [{ id: 'indicator', required: false }]
  },
  {
    kind: 'slider',
    values: [
      { id: 'value', type: 'number', required: false },
      { id: 'disabled', type: 'boolean', required: false }
    ],
    parts: [
      { id: 'track', required: true },
      { id: 'range', required: false },
      { id: 'thumb', required: true }
    ]
  },
  {
    kind: 'tabs',
    values: [{ id: 'value', type: 'choice', required: false }],
    parts: [
      { id: 'list', required: true },
      { id: 'trigger', required: true },
      { id: 'content', required: false }
    ]
  }
]

export function behaviourContract(kind: BehaviourKind): BehaviourContract | undefined {
  return BEHAVIOUR_CONTRACTS.find((contract) => contract.kind === kind)
}
