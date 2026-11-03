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
  'tab',
  'collapsible',
  'accordion'
] as const

export type BehaviourKind = (typeof BEHAVIOUR_KINDS)[number]

/**
 * The interaction states a control can show, each drawn as a value of one variant property:
 * at rest, under the pointer, while pressed, focused from the keyboard, disabled, and invalid. Only
 * a form control has an invalid state (`hasInvalidState`), shown while its value fails validation.
 */
export const INTERACTION_STATES = [
  'rest',
  'hover',
  'pressed',
  'focus',
  'disabled',
  'invalid'
] as const

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
   * radio, a toggle, a collapsible, a tab), which the control turns on and off. A tab list's
   * triggers may also be plain layers, which have no state of their own.
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

const DISABLED: BehaviourValueContract = { id: 'disabled', type: 'boolean', required: false }

/** Whether a form control's value fails validation, which code marks with `aria-invalid`. */
const INVALID: BehaviourValueContract = { id: 'invalid', type: 'boolean', required: false }

/**
 * A text field or textarea: its text is a text property, and `filled`, when bound, draws the
 * empty field with its placeholder.
 */
const TEXT_INPUT: BehaviourContract = {
  values: [
    { id: 'value', type: 'text', required: true },
    { id: 'filled', type: 'boolean', required: false },
    DISABLED,
    INVALID
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
    values: [DISABLED],
    parts: []
  },
  textField: TEXT_INPUT,
  textarea: TEXT_INPUT,
  numberField: {
    values: [
      { id: 'value', type: 'number', required: false },
      { id: 'text', type: 'text', required: true },
      DISABLED,
      INVALID
    ],
    parts: [
      { id: 'increment', required: false },
      { id: 'decrement', required: false }
    ]
  },
  toggle: {
    values: [{ id: 'value', type: 'boolean', required: true }, DISABLED],
    parts: []
  },
  switch: {
    values: [{ id: 'value', type: 'boolean', required: true }, DISABLED, INVALID],
    parts: [{ id: 'thumb', required: false }]
  },
  checkbox: {
    values: [{ id: 'value', type: 'boolean', required: true }, DISABLED, INVALID],
    parts: [{ id: 'indicator', required: false }]
  },
  radio: {
    values: [{ id: 'value', type: 'boolean', required: true }, DISABLED, INVALID],
    parts: [{ id: 'indicator', required: false }]
  },
  radioGroup: {
    values: [DISABLED, INVALID],
    parts: [{ id: 'items', required: true, items: true, children: 'item' }]
  },
  toggleGroup: {
    values: [DISABLED],
    parts: [{ id: 'items', required: true, items: true, children: 'item' }]
  },
  slider: {
    values: [{ id: 'value', type: 'number', required: false }, DISABLED],
    parts: [
      { id: 'track', required: true },
      { id: 'range', required: false },
      { id: 'thumb', required: true }
    ]
  },
  tabs: {
    values: [{ id: 'value', type: 'choice', required: false }],
    parts: [
      { id: 'list', required: true, items: true, children: 'trigger' },
      { id: 'panels', required: false, children: 'content' }
    ]
  },
  // A tab list's trigger, after Reka's TabsTrigger: on while its tab is the chosen one.
  tab: {
    values: [
      { id: 'value', type: 'boolean', required: true },
      { id: 'disabled', type: 'boolean', required: false }
    ],
    parts: []
  },
  progress: {
    values: [{ id: 'value', type: 'number', required: false }],
    parts: [
      { id: 'track', required: true },
      { id: 'indicator', required: true }
    ]
  },
  collapsible: {
    values: [{ id: 'open', type: 'boolean', required: false }, DISABLED],
    parts: [
      { id: 'trigger', required: true },
      { id: 'content', required: true }
    ]
  },
  accordion: {
    values: [DISABLED],
    parts: [{ id: 'items', required: true, items: true, children: 'item' }]
  }
}

export function behaviourContract(kind: BehaviourKind): BehaviourContract {
  return BEHAVIOUR_CONTRACTS[kind]
}

/** Whether a kind of control can be invalid: a form control, whose contract has `invalid`. */
export function hasInvalidState(kind: BehaviourKind): boolean {
  return BEHAVIOUR_CONTRACTS[kind].values.some((value) => value.id === 'invalid')
}

/** The interaction states a kind of control can show. */
export function interactionStatesOf(kind: BehaviourKind): InteractionState[] {
  return INTERACTION_STATES.filter((state) => state !== 'invalid' || hasInvalidState(kind))
}
