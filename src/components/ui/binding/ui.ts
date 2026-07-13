import { tv } from 'tailwind-variants'

import type { BindingState } from '@open-pencil/vue'

import type { ComponentUI } from '@/components/ui/types'
import theme from '@/theme/binding-field'
import type { BindingFieldTheme } from '@/theme/binding-field'

export type BindingFieldUI = ComponentUI<BindingFieldTheme>

export interface BindingFieldUIOptions {
  state?: BindingState
  open?: boolean
  disabled?: boolean
  derived?: boolean
}

export function useBindingFieldUI(options: BindingFieldUIOptions = {}, ui?: BindingFieldUI) {
  const styles = tv(theme)(options)
  return {
    root: styles.root({ class: ui?.root }),
    pill: styles.pill({ class: ui?.pill }),
    pillLabel: styles.pillLabel({ class: ui?.pillLabel }),
    trigger: styles.trigger({ class: ui?.trigger }),
    pickerContent: styles.pickerContent({ class: ui?.pickerContent }),
    pickerSearch: styles.pickerSearch({ class: ui?.pickerSearch }),
    pickerViewport: styles.pickerViewport({ class: ui?.pickerViewport }),
    pickerItem: styles.pickerItem({ class: ui?.pickerItem }),
    pickerItemIcon: styles.pickerItemIcon({ class: ui?.pickerItemIcon }),
    pickerItemLabel: styles.pickerItemLabel({ class: ui?.pickerItemLabel }),
    pickerItemIndicator: styles.pickerItemIndicator({ class: ui?.pickerItemIndicator }),
    pickerEmpty: styles.pickerEmpty({ class: ui?.pickerEmpty }),
    pickerFooter: styles.pickerFooter({ class: ui?.pickerFooter }),
    pickerAction: styles.pickerAction({ class: ui?.pickerAction }),
    createForm: styles.createForm({ class: ui?.createForm }),
    createInput: styles.createInput({ class: ui?.createInput }),
    createSubmit: styles.createSubmit({ class: ui?.createSubmit })
  }
}
