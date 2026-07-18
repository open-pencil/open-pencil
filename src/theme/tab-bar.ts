const tabBarTheme = {
  slots: {
    root: 'scrollbar-none flex h-9 shrink-0 items-end overflow-x-auto border-b border-border bg-canvas',
    list: 'flex h-full items-end',
    trigger:
      'group/tab flex h-full max-w-48 min-w-0 cursor-pointer items-center gap-1.5 border-r border-border px-3 text-[11px] transition-colors outline-none select-none focus-visible:ring-1 focus-visible:ring-accent',
    icon: 'size-3 shrink-0 opacity-50',
    label: 'min-w-0 flex-1 truncate',
    close:
      'flex size-4 shrink-0 cursor-pointer items-center justify-center rounded transition-opacity group-hover/tab:opacity-100 hover:bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-panel-focus',
    closeIcon: 'size-3',
    newAction:
      'flex size-9 shrink-0 cursor-pointer items-center justify-center text-muted transition-colors hover:text-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-panel-focus',
    newIcon: 'size-3.5'
  },
  variants: {
    active: {
      true: {
        trigger: 'bg-panel text-surface',
        close: 'opacity-100'
      },
      false: {
        trigger: 'text-muted hover:text-surface',
        close: 'opacity-0'
      }
    }
  },
  defaultVariants: {
    active: false
  }
}

export type TabBarTheme = typeof tabBarTheme
export default tabBarTheme
