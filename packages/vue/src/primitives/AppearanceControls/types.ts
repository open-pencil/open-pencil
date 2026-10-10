import type { VNode } from 'vue'

import type { BlendMode, SceneNode } from '@open-pencil/scene-graph'

import type { CornerGeometryKey, CornerRadiusKey } from '#vue/controls/appearance/types'
import type { MixedValue } from '#vue/controls/node-props/use'

export interface AppearanceControlsActions {
  updateProp(key: string, value: number): void
  commitProp(key: string, value: number, previous: number): void
  setBlendMode(value: BlendMode): void
  toggleVisibility(): void
  toggleIndependentCorners(): void
  updateUniformRadius(value: number): void
  commitUniformRadius(): void
  updateCornerProp(key: CornerGeometryKey, value: number): void
  commitCornerProp(key: CornerGeometryKey, value: number, previous: number): void
}

export interface AppearanceControlsRootSlotProps {
  node: SceneNode | null
  isMulti: boolean
  active: boolean
  hasCornerRadius: boolean
  /** A multi-selection with no layer that has corners shows the radius disabled, as Figma does. */
  cornerRadiusDisabled: boolean
  /** Whether the corners can take separate radii; a polygon's or star's share one. */
  splitsCorners: boolean
  /** Whether every selected layer is a polygon or star, which has a point count. */
  hasPointCount: boolean
  /** Whether every selected layer is a star, which has an inner ratio. */
  hasStarRatio: boolean
  pointCount: MixedValue<number>
  /** A star's inner radius as a percentage of its outer radius, to one decimal. */
  starRatioPercent: MixedValue<number>
  independentCorners: MixedValue<boolean>
  showIndependentCorners: boolean
  cornerRadiusValue: MixedValue<number>
  cornerRadiusBindingPaths: Array<CornerRadiusKey | 'cornerRadius'>
  cornerSmoothingPercent: MixedValue<number>
  opacityPercent: MixedValue<number>
  blendModeValue: MixedValue<BlendMode>
  visibilityState: 'visible' | 'hidden' | 'mixed'
  actions: AppearanceControlsActions
}

export interface AppearanceControlsRootSlots {
  /** Complete selection-derived appearance state and mutation actions. */
  default(props: AppearanceControlsRootSlotProps): VNode[]
}
