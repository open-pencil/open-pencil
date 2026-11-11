import { focusStyles } from '../focus/styles'

/**
 * The menu button at the end of a field. It is the same 20px box as the variable button beside it,
 * so a field's trailing controls sit on one rhythm and share hover and open states. A tint of the
 * text colour marks hover and open, because the hover token is darker than a field in the dark theme.
 */
const selectFieldTriggerTheme = {
  slots: {
    root: [
      'flex h-5 shrink-0 cursor-pointer items-center justify-center gap-0.5 rounded-sm border border-transparent bg-transparent text-3xs text-muted outline-none hover:bg-surface/10 hover:text-surface focus:text-surface data-[state=open]:bg-surface/10 data-[state=open]:text-surface',
      focusStyles.ring
    ],
    chevron: 'size-3 shrink-0'
  },
  variants: {
    /** A trigger that names the chosen mode, such as Hug, grows to fit it. */
    labelled: {
      true: { root: 'px-0.75' },
      false: { root: 'w-5' }
    }
  }
}

export type SelectFieldTriggerTheme = typeof selectFieldTriggerTheme
export default selectFieldTriggerTheme
