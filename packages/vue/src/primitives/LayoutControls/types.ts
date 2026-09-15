import type { ShallowUnwrapRef, VNode } from 'vue'

import type { useLayout } from '#vue/controls/layout/use'

type LayoutContext = ShallowUnwrapRef<ReturnType<typeof useLayout>>
type LayoutActionKey =
  | 'cancelPreview'
  | 'updateProp'
  | 'updateSizeLimit'
  | 'setSizeLimitToCurrent'
  | 'commitSizeLimit'
  | 'addSizeLimit'
  | 'removeSizeLimit'
  | 'commitProp'
  | 'setAxisSizing'
  | 'updateAxisSize'
  | 'commitAxisSize'
  | 'setHorizontalPadding'
  | 'commitHorizontalPadding'
  | 'setVerticalPadding'
  | 'commitVerticalPadding'
  | 'setAlignment'
  | 'setGapAuto'
  | 'setLayoutDirection'
  | 'updateGridTrack'
  | 'addTrack'
  | 'removeTrack'
  | 'toggleIndividualPadding'

export type LayoutControlsRootSlotProps = Omit<LayoutContext, LayoutActionKey> & {
  actions: Pick<LayoutContext, LayoutActionKey>
}

export interface LayoutControlsRootSlots {
  /** Current layout state and mutation actions for the active selection. */
  default(props: LayoutControlsRootSlotProps): VNode[]
}
