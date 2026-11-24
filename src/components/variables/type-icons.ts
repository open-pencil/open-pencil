import type { Component } from 'vue'
import IconClock from '~icons/lucide/clock'
import IconHash from '~icons/lucide/hash'
import IconPalette from '~icons/lucide/palette'
import IconSpline from '~icons/lucide/spline'
import IconToggleLeft from '~icons/lucide/toggle-left'
import IconType from '~icons/lucide/type'

import type { VariableType } from '@open-pencil/scene-graph'

/** One icon per variable type, shared by the add menu, the list rows, and the type filter. */
export const VARIABLE_TYPE_ICONS: Record<VariableType, Component> = {
  COLOR: IconPalette,
  FLOAT: IconHash,
  STRING: IconType,
  BOOLEAN: IconToggleLeft,
  EASING: IconSpline,
  TIMING: IconClock
}
