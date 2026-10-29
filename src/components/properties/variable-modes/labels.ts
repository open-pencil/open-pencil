import type { VariableModeChoice } from '@open-pencil/vue/controls/variable-modes'
import type { usePanelMessages } from '@open-pencil/vue/i18n'

type PanelMessages = ReturnType<typeof usePanelMessages>['value']

/** The value Auto stands for in the menu and the row select; mode ids never take this form. */
export const AUTO_MODE = ':auto'

/** "Auto (Light)", naming the mode the targets inherit, or "Auto" when they inherit different ones. */
export function autoModeLabel(panels: PanelMessages, choice: VariableModeChoice): string {
  return choice.inherited
    ? panels.variableModeAuto({ mode: choice.inherited.name })
    : panels.variableModeAutoMixed
}
