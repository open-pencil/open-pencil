import type { VNode } from 'vue'

import type { ConstraintType } from '@lawha/scene-graph'

import type {
  ConstraintAxis,
  ConstraintEdge,
  ConstraintValue
} from '#vue/controls/constraints/model'

export interface ConstraintsControlActions {
  setHorizontal(value: ConstraintType): void
  setVertical(value: ConstraintType): void
  setCenter(axis: ConstraintAxis): void
  togglePin(axis: ConstraintAxis, edge: ConstraintEdge, additive: boolean): void
}

export interface ConstraintsControlRootSlotProps {
  active: boolean
  isMulti: boolean
  horizontal: ConstraintValue
  vertical: ConstraintValue
  actions: ConstraintsControlActions
}

export interface ConstraintsControlRootSlots {
  /** Constraint state and undo-aware actions for the current eligible selection. */
  default(props: ConstraintsControlRootSlotProps): VNode[]
}
