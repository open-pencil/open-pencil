import type { Color } from '@open-pencil/scene-graph/primitives'
import type { BindingState } from '@open-pencil/vue'

import type { BindingFieldUI } from './ui'

export interface VariablePickerItem {
  id: string
  name: string
  /** The collection the variable belongs to; the list groups by it. */
  collection?: string
  /** A color variable's value, shown as a swatch in place of the variable icon. */
  color?: Color
}

export interface VariablePickerProps {
  items: VariablePickerItem[]
  /** The variable the value points at now, checked in the list. */
  selected?: string
  state: BindingState
  triggerLabel: string
  searchPlaceholder: string
  emptyLabel: string
  detachLabel: string
  closeLabel?: string
  createLabel?: string
  createNamePlaceholder?: string
  createSubmitLabel?: string
  createDefaultName?: string
  disabled?: boolean
  derived?: boolean
  side?: 'left' | 'right' | 'top' | 'bottom'
  ui?: BindingFieldUI
}
