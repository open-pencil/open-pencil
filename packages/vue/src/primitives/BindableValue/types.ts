import type { PrimitiveProps } from 'reka-ui'
import type { ComputedRef, Ref, VNode } from 'vue'

import type { Variable } from '@open-pencil/scene-graph'

import type {
  BindingMutationSource,
  BindingProvider,
  BindingState,
  BindingTarget,
  BoundEditPolicy
} from '#vue/controls/binding-provider/types'

export type BindableValueTriggerProps = PrimitiveProps

export interface BindableValueRootProps<V = unknown> {
  /** Binding implementation. Falls back to the nearest injected provider. */
  provider?: BindingProvider<V>
  /** Node/property pairs participating in this binding. */
  targets: BindingTarget[]
  /** Direct field value used when the targets are not consistently bound. */
  value: V
  /** Behavior when a consistently bound field is edited. @default 'detach-on-edit' */
  policy?: BoundEditPolicy
  /** Undo label for a field interaction transaction. @default 'Edit bound value' */
  batchLabel?: string
}

export interface BindableValueStateAttrs {
  'data-unbound'?: ''
  'data-bound'?: ''
  'data-mixed'?: ''
  'data-picker-open'?: ''
  'data-policy': BoundEditPolicy
}

export interface BindableValueActions<V = unknown> {
  bind(variableId: string): void
  unbind(): void
  create(name: string): void
  openPicker(): void
  closePicker(): void
  togglePicker(): void
  setSearchTerm(term: string): void
  beginMutation(source: BindingMutationSource): boolean
  applyValue(value: V): boolean
  commitMutation(): void
  cancelMutation(): void
}

export interface BindableValueSlotProps<V = unknown> {
  state: BindingState
  variable: Variable | undefined
  resolvedValue: V | undefined
  policy: BoundEditPolicy
  open: boolean
  searchTerm: string
  variables: Variable[]
  stateAttrs: BindableValueStateAttrs
  actions: BindableValueActions<V>
}

export interface BindableValueRootSlots<V = unknown> {
  /** Complete render contract for binding-aware controls. */
  default(props: BindableValueSlotProps<V>): VNode[]
}

export interface BindableValueContext<V = unknown> {
  provider: BindingProvider<V>
  targets: ComputedRef<BindingTarget[]>
  value: ComputedRef<V>
  state: ComputedRef<BindingState>
  variable: ComputedRef<Variable | undefined>
  resolvedValue: ComputedRef<V | undefined>
  policy: ComputedRef<BoundEditPolicy>
  open: Ref<boolean>
  searchTerm: Ref<string>
  variables: ComputedRef<Variable[]>
  stateAttrs: ComputedRef<BindableValueStateAttrs>
  slotProps: ComputedRef<BindableValueSlotProps<V>>
  actions: BindableValueActions<V>
}
