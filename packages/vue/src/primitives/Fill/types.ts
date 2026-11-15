import type { PrimitiveProps } from 'reka-ui'

import type { Fill } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

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
  /**
   * Accessible name for the preview. Without one the swatch is decorative and hidden from
   * assistive technology, as when a button or row around it already names the color.
   */
  label?: string
}

export interface FillSwatchSlotProps {
  fill: Fill
  color: Color
  category: FillCategory
  background: string
  transparent: boolean
}

export interface FillSwatchSlots {
  default?: (props: FillSwatchSlotProps) => unknown
}
