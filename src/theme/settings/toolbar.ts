/** Rows of Settings › Toolbar: one per tool or command, boxed by the flyout they share. */
export default {
  slots: {
    root: 'flex flex-col gap-2',
    group: 'flex flex-col divide-y divide-border rounded border border-border',
    row: 'flex items-center gap-2 px-2 py-1.5',
    spacer: 'size-6 shrink-0',
    icon: 'size-4 shrink-0 text-surface',
    label: 'min-w-0 flex-1 truncate text-xs text-surface',
    shortcut: 'w-4 shrink-0 text-center',
    controls: 'flex shrink-0 items-center gap-1'
  },
  variants: {
    hidden: {
      true: { icon: 'text-muted', label: 'text-muted' }
    }
  }
}
