import type { Component, ComputedRef, VNode } from 'vue'

export type SegmentedControlMode = 'single' | 'multiple' | 'action'
export type SegmentedControlOrientation = 'horizontal' | 'vertical'

export interface SegmentedControlRootProps {
  /** Selection behavior or stateless action behavior. @default 'single' */
  mode?: SegmentedControlMode
  /** Controlled selected value or values. */
  modelValue?: string | string[]
  /** Arrow-key navigation axis. @default 'horizontal' */
  orientation?: SegmentedControlOrientation
  /** Disable every item. @default false */
  disabled?: boolean
  /** Require a value in single-selection mode. @default false */
  required?: boolean
  /** Enable arrow-key roving focus. @default true */
  rovingFocus?: boolean
  /** Wrap keyboard focus at the first and last item. @default true */
  loop?: boolean
}

export interface SegmentedControlItemProps {
  /** Stable selection or action identifier. */
  value: string
  /** Disable this item. @default false */
  disabled?: boolean
  /** Element or component rendered by this item. @default 'button' */
  as?: string | Component
  /** Merge item behavior into the single child element. @default false */
  asChild?: boolean
}

export interface SegmentedControlItemSlotProps {
  value: string
  selected: boolean
  disabled: boolean
  mode: SegmentedControlMode
}

export interface SegmentedControlRootSlots {
  default(props: { mode: SegmentedControlMode; modelValue: string | string[] | undefined }): VNode[]
}

export interface SegmentedControlItemSlots {
  default(props: SegmentedControlItemSlotProps): VNode[]
}

export interface SegmentedControlContext {
  mode: ComputedRef<SegmentedControlMode>
  modelValue: ComputedRef<string | string[] | undefined>
  disabled: ComputedRef<boolean>
  selected(value: string): boolean
  activate(value: string): void
}
