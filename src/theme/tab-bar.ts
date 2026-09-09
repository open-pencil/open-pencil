const tabBarTheme = {
  slots: {
    root: 'scrollbar-none flex h-9 shrink-0 items-end overflow-x-auto border-b border-border bg-canvas',
    list: 'flex h-full items-end',
    item: 'group/tab flex h-full max-w-48 min-w-0 items-center border-r border-border pr-3',
    trigger:
      'flex h-full min-w-0 cursor-pointer touch-manipulation items-center gap-1.5 px-3 text-[11px] transition-colors outline-none select-none focus-visible:ring-1 focus-visible:ring-accent',
    icon: 'size-3 shrink-0 opacity-50',
    label: 'min-w-0 flex-1 truncate',
    close:
      'flex size-6 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded transition-opacity group-hover/tab:opacity-100 hover:bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-panel-focus sm:size-4',
    closeIcon: 'size-3',
    newIcon: 'size-3.5'
  },
  variants: {
    active: {
      true: {
        item: 'bg-panel text-surface',
        trigger: 'bg-panel text-surface',
        close: 'opacity-100'
      },
      false: {
        item: 'text-muted hover:text-surface',
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
