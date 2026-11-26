import { focusStyles } from '@open-pencil/theme'

/** The easing field, its editor popover, and the graph whose handles drag a curve or spring. */
export default {
  slots: {
    /**
     * The name that opens the editor, filling the field's value area; the field shows its focus
     * on its own border.
     */
    trigger:
      'flex h-full min-w-0 flex-1 items-center text-start text-xs text-surface outline-hidden',
    thumbnail: 'size-4 shrink-0 text-muted',
    name: 'truncate',
    editor: 'flex w-56 flex-col gap-3 p-3',
    header: 'flex items-center gap-1',
    /** The chosen preset's thumbnail before its name in the select. */
    presetThumbnail: 'me-1.5 size-4 shrink-0 text-muted',
    /** A preset's row in the menu: its thumbnail and name on one centre line. */
    presetOption: 'flex items-center gap-1.5',
    presetOptionThumbnail: 'size-4 shrink-0 text-muted',
    graph: 'relative aspect-square w-full touch-none rounded-md bg-panel-secondary select-none',
    guides: 'absolute inset-0 size-full text-muted/60',
    arms: 'absolute inset-0 size-full text-accent',
    line: 'absolute inset-0 size-full text-surface',
    handle: [
      'absolute size-2.5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-[0.09375rem] border-accent bg-panel active:cursor-grabbing',
      focusStyles.ringStrong
    ],
    row: 'flex items-center gap-1',
    fields: 'grid grid-cols-3 gap-1',
    fieldLabel: 'text-3xs text-muted'
  }
} as const
