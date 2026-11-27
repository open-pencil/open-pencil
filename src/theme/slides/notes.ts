import { focusStyles } from '@open-pencil/theme'

/** The strip under the canvas that holds the speaker notes of the slide being looked at. */
const slideNotesTheme = {
  slots: {
    root: 'flex min-h-0 flex-1 flex-col border-t border-border bg-panel',
    label: 'shrink-0 px-3 pt-2 text-2xs font-semibold text-surface',
    field: [
      'min-h-0 flex-1 resize-none bg-transparent px-3 py-1.5 text-xs/5 text-surface placeholder:text-muted',
      focusStyles.ringInset
    ],
    empty: 'px-3 py-1.5 text-xs text-muted'
  }
}

export default slideNotesTheme
