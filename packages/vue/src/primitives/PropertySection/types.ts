import type { PrimitiveProps } from 'reka-ui'
import type { ComputedRef, VNode } from 'vue'

export interface PropertySectionRootProps {
  /** Controlled expanded state. */
  open?: boolean
  /** Initial expanded state when uncontrolled. @default true */
  defaultOpen?: boolean
  /** Marks the section as having no current items. @default false */
  empty?: boolean
  /** Prevents the section from being toggled. @default false */
  disabled?: boolean
  /** Keep collapsed content mounted in the DOM. @default false */
  unmountOnHide?: boolean
}

export type PropertySectionPartProps = PrimitiveProps

export interface PropertySectionStateAttrs {
  'data-state': 'open' | 'closed'
  'data-empty'?: ''
  'data-disabled'?: ''
}

export interface PropertySectionActionAPI {
  open(): void
  close(): void
  toggle(): void
}

export interface PropertySectionSlotProps {
  open: boolean
  empty: boolean
  stateAttrs: PropertySectionStateAttrs
  actions: PropertySectionActionAPI
}

export interface PropertySectionRootSlots {
  default(props: PropertySectionSlotProps): VNode[]
}

export interface PropertySectionContext {
  open: ComputedRef<boolean>
  empty: ComputedRef<boolean>
  disabled: ComputedRef<boolean>
  stateAttrs: ComputedRef<PropertySectionStateAttrs>
  slotProps: ComputedRef<PropertySectionSlotProps>
  actions: PropertySectionActionAPI
}
