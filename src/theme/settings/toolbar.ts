/** Rows of Settings › Toolbar: one per tool or command, boxed by the flyout they share. */
export default {
  slots: {
    root: 'flex flex-col gap-2',
    group: 'flex flex-col divide-y divide-border rounded border border-border',
    row: 'group/row relative flex cursor-grab items-center gap-2 px-2 py-1.5 data-[dragging]:opacity-40',
    grip: 'cursor-grab text-muted',
    link: 'opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 data-[state=on]:opacity-100 [@media(hover:none)]:opacity-100',
    spacer: 'size-6 shrink-0',
    icon: 'size-4 shrink-0 text-surface',
    label: 'min-w-0 flex-1 truncate text-xs text-surface',
    shortcut: 'w-4 shrink-0 text-center',
    line: 'pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full bg-accent',
    target: 'pointer-events-none absolute inset-0 z-10 rounded-sm ring-2 ring-inset ring-accent'
  },
  variants: {
    hidden: {
      true: { icon: 'text-muted', label: 'text-muted' }
    },
    /** Where the drop line sits: on a divider inside a box, or in the gap between boxes. */
    edge: {
      'inside-top': { line: '-top-px' },
      'inside-bottom': { line: '-bottom-px' },
      'between-top': { line: '-top-[5px]' },
      'between-bottom': { line: '-bottom-[5px]' }
    }
  }
}
