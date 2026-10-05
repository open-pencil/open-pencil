/** The controls a main component can behave as, in the order the picker lists them. */
export const BEHAVIOUR_KINDS = [
  'button',
  'textField',
  'textarea',
  'numberField',
  'toggle',
  'switch',
  'checkbox',
  'radio',
  'radioGroup',
  'toggleGroup',
  'slider',
  'progress',
  'tabs',
  'collapsible',
  'accordion'
] as const

export type BehaviourKind = (typeof BEHAVIOUR_KINDS)[number]

/**
 * The interaction states a control can show, each drawn as a value of one variant property:
 * at rest, under the pointer, while pressed, focused from the keyboard, and disabled.
 */
export const INTERACTION_STATES = ['rest', 'hover', 'pressed', 'focus', 'disabled'] as const

export type InteractionState = (typeof INTERACTION_STATES)[number]

/**
 * How a behaviour value is held. A boolean is a variant or boolean property of the component,
 * and text is a text property. Figma has no number property, so a number is the behaviour's
 * own (min, max, step, default); a choice is which item of a slot is active, the first by
 * default.
 */
export type BehaviourValueType = 'boolean' | 'text' | 'number' | 'choice'

/** A value of the control: its state, which preview reads and changes. */
export interface BehaviourValueContract {
  id: string
  type: BehaviourValueType
  /** Whether a boolean or text value must be bound before the behaviour is complete. */
  required: boolean
}

/**
 * A Reka UI subcomponent of the control, which is a slot of the component: the behaviour binds
 * it to one of the component's slot properties, never to a layer found by name.
 */
export interface BehaviourPartContract {
  id: string
  required: boolean
  /**
   * Whether the slot holds the control's items, each an instance with its own behaviour (a
   * radio, a toggle, a collapsible), which the control turns on and off.
   */
  items?: boolean
  /**
   * The Reka UI part each child of the slot is, when the slot holds repeated parts: a tab list's
   * triggers, the tabs' content panels, or a group's items.
   */
  children?: string
}

export interface BehaviourContract {
  values: BehaviourValueContract[]
  parts: BehaviourPartContract[]
}

/**
 * A text field or textarea: its text is a text property, and `filled`, when bound, draws the
 * empty field with its placeholder.
 */
const TEXT_INPUT: BehaviourContract = {
  values: [
    { id: 'value', type: 'text', required: true },
    { id: 'filled', type: 'boolean', required: false },
    { id: 'disabled', type: 'boolean', required: false }
  ],
  parts: []
}

/**
 * The behaviours OpenPencil knows, after Reka UI's primitives. Their states are drawn as the
 * component's variants and properties; their subcomponents (thumb, range, trigger, …) are the
 * component's slots, and the component itself is the control's root.
 */
export const BEHAVIOUR_CONTRACTS: Readonly<Record<BehaviourKind, BehaviourContract>> = {
  button: {
    values: [{ id: 'disabled', type: 'boolean', required: false }],
    parts: []
  },
  textField: TEXT_INPUT,
  textarea: TEXT_INPUT,
  numberField: {
    values: [
      { id: 'value', type: 'number', required: false },
      { id: 'text', type: 'text', required: true },
      { id: 'disabled', type: 'boolean', required: false }
    ],
    parts: [
      { id: 'increment', required: false },
      { id: 'decrement', required: false }
    ]
  },
  toggle: {
    values: [
      { id: 'value', type: 'boolean', required: true },
      { id: 'disabled', type: 'boolean', required: false }
    ],
    parts: []
  },
  switch: {
    values: [
      { id: 'value', type: 'boolean', required: true },
      { id: 'disabled', type: 'boolean', required: false }
    ],
    parts: [{ id: 'thumb', required: false }]
  },
  checkbox: {
    values: [
      { id: 'value', type: 'boolean', required: true },
      { id: 'disabled', type: 'boolean', required: false }
    ],
    parts: [{ id: 'indicator', required: false }]
  },
  radio: {
    values: [
      { id: 'value', type: 'boolean', required: true },
      { id: 'disabled', type: 'boolean', required: false }
    ],
    parts: [{ id: 'indicator', required: false }]
  },
  radioGroup: {
    values: [{ id: 'disabled', type: 'boolean', required: false }],
    parts: [{ id: 'items', required: true, items: true, children: 'item' }]
  },
  toggleGroup: {
    values: [{ id: 'disabled', type: 'boolean', required: false }],
    parts: [{ id: 'items', required: true, items: true, children: 'item' }]
  },
  slider: {
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
  tabs: {
    values: [{ id: 'value', type: 'choice', required: false }],
    parts: [
      { id: 'list', required: true, children: 'trigger' },
      { id: 'panels', required: false, children: 'content' }
    ]
  },
  progress: {
    values: [{ id: 'value', type: 'number', required: false }],
    parts: [
      { id: 'track', required: true },
      { id: 'indicator', required: true }
    ]
  },
  collapsible: {
    values: [
      { id: 'open', type: 'boolean', required: false },
      { id: 'disabled', type: 'boolean', required: false }
    ],
    parts: [
      { id: 'trigger', required: true },
      { id: 'content', required: true }
    ]
  },
  accordion: {
    values: [{ id: 'disabled', type: 'boolean', required: false }],
    parts: [{ id: 'items', required: true, items: true, children: 'item' }]
  }
}

export function behaviourContract(kind: BehaviourKind): BehaviourContract {
  return BEHAVIOUR_CONTRACTS[kind]
}
