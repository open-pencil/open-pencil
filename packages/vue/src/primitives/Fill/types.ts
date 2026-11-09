import type { PrimitiveProps } from 'reka-ui'

import type { Fill } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { BindingState } from '#vue/controls/binding-provider/types'
import type { BindableValueStateAttrs } from '#vue/primitives/BindableValue/types'

export type FillCategory = 'SOLID' | 'GRADIENT' | 'IMAGE'

export interface FillActions {
  toSolid: () => void
  toGradient: () => void
  toImage: () => void
}

export interface FillRootSlotProps {
  fill: Fill
  category: FillCategory
  swatchBackground: string
  transparent: boolean
  actions: FillActions
}

export interface FillRootSlots {
  default?: (props: FillRootSlotProps) => unknown
}

export interface FillSwatchProps extends PrimitiveProps {
  /** Fill represented by the swatch. */
  fill: Fill
  /** Accessible name for the preview. */
  label?: string
  /**
   * Show `fill` as given inside a bound `BindableValueRoot`, instead of the bound variable's
   * color: for swatches that preview other values, such as a variable picker's rows.
   */
  ignoreBinding?: boolean
}

export interface FillSwatchSlotProps {
  fill: Fill
  color: Color
  category: FillCategory
  background: string
  transparent: boolean
  bindingState: BindingState | undefined
  stateAttrs: BindableValueStateAttrs | undefined
}

export interface FillSwatchSlots {
  default?: (props: FillSwatchSlotProps) => unknown
}
