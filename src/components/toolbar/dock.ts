import { computed, toValue, type Component, type MaybeRefOrGetter } from 'vue'
import IconPanelBottom from '~icons/lucide/panel-bottom'
import IconPanelLeft from '~icons/lucide/panel-left'
import IconPanelRight from '~icons/lucide/panel-right'
import IconPanelTop from '~icons/lucide/panel-top'

import { useSettingsMessages } from '@open-pencil/vue/i18n'
import { TOOLBAR_ALIGNS, toolbarOrientation } from '@open-pencil/vue/primitives/Toolbar'
import type { ToolbarAlign, ToolbarSide } from '@open-pencil/vue/primitives/Toolbar'

export interface ToolbarDockOption<T extends string> {
  value: T
  label: string
  icon?: Component
}

/** Settings and the toolbar's menu list the edges in this order: Figma's first. */
const SIDES: readonly ToolbarSide[] = ['bottom', 'top', 'left', 'right']

const SIDE_ICONS: Record<ToolbarSide, Component> = {
  bottom: IconPanelBottom,
  top: IconPanelTop,
  left: IconPanelLeft,
  right: IconPanelRight
}

/** The edges the toolbar docks to, labelled for the Settings page and the toolbar's menu. */
export function useToolbarSideOptions() {
  const settings = useSettingsMessages()
  return computed<ToolbarDockOption<ToolbarSide>[]>(() => {
    const labels: Record<ToolbarSide, string> = {
      bottom: settings.value.toolbarPositionBottom,
      top: settings.value.toolbarPositionTop,
      left: settings.value.toolbarPositionLeft,
      right: settings.value.toolbarPositionRight
    }
    return SIDES.map((value) => ({ value, label: labels[value], icon: SIDE_ICONS[value] }))
  })
}

/** The places along an edge, named for its direction: Left/Right on a row, Top/Bottom on a column. */
export function useToolbarAlignOptions(side: MaybeRefOrGetter<ToolbarSide>) {
  const settings = useSettingsMessages()
  return computed<ToolbarDockOption<ToolbarAlign>[]>(() => {
    const s = settings.value
    const labels: Record<ToolbarAlign, string> =
      toolbarOrientation(toValue(side)) === 'vertical'
        ? { start: s.toolbarAlignTop, center: s.toolbarAlignMiddle, end: s.toolbarAlignBottom }
        : { start: s.toolbarAlignLeft, center: s.toolbarAlignCenter, end: s.toolbarAlignRight }
    return TOOLBAR_ALIGNS.map((value) => ({ value, label: labels[value] }))
  })
}
