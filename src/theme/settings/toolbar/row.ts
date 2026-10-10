/** One tool or command in Settings › Toolbar. */
export default {
  slots: {
    root: 'relative flex cursor-grab items-center gap-2 px-2 py-1.5',
    grip: 'cursor-grab text-muted',
    icon: 'size-4 shrink-0 text-surface',
    label: 'min-w-0 flex-1 truncate text-xs text-surface',
    shortcut: 'w-4 shrink-0 text-center',
    target: 'pointer-events-none absolute inset-0 rounded-sm ring-2 ring-inset ring-accent'
  },
  variants: {
    hidden: {
      true: { icon: 'text-muted', label: 'text-muted' }
    }
  }
}
