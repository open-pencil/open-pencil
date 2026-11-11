import { focusStyles } from '../focus/styles'

/** The path in the Settings window's title while an editor is open. */
export default {
  slots: {
    root: 'flex min-w-0 items-center gap-1.5',
    step: [
      'shrink-0 cursor-pointer rounded-sm whitespace-nowrap text-muted outline-none hover:text-surface',
      focusStyles.ring
    ],
    separator: 'size-3.5 shrink-0 text-muted',
    current: 'min-w-0 truncate'
  }
}
