import type { VNode } from 'vue'

export type PropertyGridColumns = 1 | 2 | 3
export type PropertyGridDistribution = 'equal' | 'wide-first'

export interface PropertyGridRootProps {
  /** Number of field columns. @default 1 */
  columns?: PropertyGridColumns
  /** Relative distribution of field columns. @default 'equal' */
  distribution?: PropertyGridDistribution
}

export interface PropertyGridRootSlots {
  /** Property fields arranged by the consumer's visual theme. */
  default(): VNode[]
  /** Optional intrinsic-width controls kept separate from the field grid. */
  actions?(): VNode[]
}
