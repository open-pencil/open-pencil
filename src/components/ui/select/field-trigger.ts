import { tv } from 'tailwind-variants'

import type { ComponentUI } from '@/components/ui/types'
import theme from '@/theme/select/field-trigger'
import type { SelectFieldTriggerTheme } from '@/theme/select/field-trigger'

export type SelectFieldTriggerUI = ComponentUI<SelectFieldTriggerTheme>

/** Classes for a field's menu button whose menu is not a select, such as a dropdown of presets. */
export function useSelectFieldTriggerUI(
  options: { labelled?: boolean } = {},
  ui?: SelectFieldTriggerUI
) {
  const styles = tv(theme)(options)
  return {
    root: styles.root({ class: ui?.root }),
    chevron: styles.chevron({ class: ui?.chevron })
  }
}
