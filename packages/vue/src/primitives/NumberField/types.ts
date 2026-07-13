import type { ComputedRef, Ref, VNode } from 'vue'

import type { NumberExpressionError } from '#vue/controls/number-expression'

export type NumberFieldEditPolicy = 'editable' | 'readonly' | 'detach-on-edit'
export type NumberFieldMutationSource = 'edit' | 'scrub' | 'step'

export interface NumberFieldRootProps {
  /** Current numeric value or the mixed-value sentinel. */
  modelValue: number | symbol
  /** Minimum allowed value. */
  min?: number
  /** Maximum allowed value and percentage-expression basis. */
  max?: number
  /** Pointer-scrub and Arrow-key increment. */
  step?: number
  /** Multiplier applied to pointer-scrub movement. */
  sensitivity?: number
  /** Text shown when modelValue is mixed. */
  placeholder?: string
  /** Accessible name for the spinbutton. */
  ariaLabel?: string
  /** Prevents editing, scrubbing, and keyboard stepping. */
  disabled?: boolean
  /** Marks the value as controlled by an external binding. */
  bound?: boolean
  /** Mutation policy used when the value is bound. */
  editPolicy?: NumberFieldEditPolicy
}

export interface NumberFieldRootEmits {
  /** Emitted for live numeric updates and committed expression results. */
  (event: 'update:modelValue', value: number): void
  /** Emitted once after a changed interaction is committed. */
  (event: 'commit', value: number, previous: number): void
  /** Emitted when the inline editing state changes. */
  (event: 'editing-change', editing: boolean): void
  /** Emitted when a committed expression cannot be evaluated. */
  (event: 'invalid', expression: string, reason: NumberExpressionError): void
  /** Emitted before detach-on-edit mutates a bound value. */
  (event: 'detach-request', source: NumberFieldMutationSource): void
}

export interface NumberFieldState {
  editing: boolean
  scrubbing: boolean
  mixed: boolean
  disabled: boolean
  bound: boolean
}

export interface NumberFieldStateAttrs {
  'data-editing'?: ''
  'data-scrubbing'?: ''
  'data-mixed'?: ''
  'data-disabled'?: ''
  'data-bound'?: ''
}

export interface NumberFieldRootAttrs extends NumberFieldStateAttrs {
  role: 'spinbutton' | undefined
  tabindex: 0 | -1 | undefined
  'aria-valuenow'?: number
  'aria-valuemin'?: number
  'aria-valuemax'?: number
  'aria-disabled'?: 'true'
  'aria-label'?: string
  onFocus: () => void
  onKeydown: (event: KeyboardEvent) => void
}

export interface NumberFieldActions {
  startScrub(event: PointerEvent): void
  startEdit(): void
  cancelEdit(): void
  commitEdit(event?: Event): void
  setDraft(value: string): void
  input(event: Event): void
  keydown(event: KeyboardEvent): void
}

export interface NumberFieldSlotProps extends NumberFieldState {
  modelValue: number | symbol
  displayValue: string
  draftValue: string
  isMixed: boolean
  placeholder: string
  state: NumberFieldState
  attrs: NumberFieldRootAttrs
  actions: NumberFieldActions
}

export interface NumberFieldRootSlots {
  /** Complete render contract for composing a numeric field. */
  default(props: NumberFieldSlotProps): VNode[]
}

export interface NumberFieldValueSlots {
  /** Non-editing display value plus the complete field render contract. */
  default(props: NumberFieldSlotProps & { value: string }): VNode[]
}

export interface NumberFieldContext {
  modelValue: ComputedRef<number | symbol>
  numericValue: ComputedRef<number>
  displayValue: ComputedRef<string>
  draftValue: Ref<string>
  isMixed: ComputedRef<boolean>
  editing: Ref<boolean>
  scrubbing: Ref<boolean>
  disabled: ComputedRef<boolean>
  bound: ComputedRef<boolean>
  min: ComputedRef<number>
  max: ComputedRef<number>
  step: ComputedRef<number>
  inputRef: Ref<HTMLInputElement | null>
  state: ComputedRef<NumberFieldState>
  stateAttrs: ComputedRef<NumberFieldStateAttrs>
  rootAttrs: ComputedRef<NumberFieldRootAttrs>
  slotProps: ComputedRef<NumberFieldSlotProps>
  actions: NumberFieldActions
  invalidReason: Ref<NumberExpressionError | null>
}
