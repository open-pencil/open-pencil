export default {
  slots: {
    root: 'flex min-h-0 min-w-0 flex-1 flex-col data-[orientation=vertical]:flex-row',
    list: 'flex min-w-0 shrink-0 gap-1 overflow-x-auto p-2 data-[orientation=vertical]:w-40 data-[orientation=vertical]:flex-col data-[orientation=vertical]:border-r data-[orientation=vertical]:border-border',
    trigger:
      'flex shrink-0 cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-muted transition-colors hover:bg-hover hover:text-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-default disabled:opacity-50 data-[state=active]:bg-hover data-[state=active]:text-surface',
    // A group's name above its tabs, as macOS and VS Code label their settings sidebars.
    heading:
      'px-2 pt-3 pb-1 text-[10px] font-medium tracking-wide text-muted uppercase select-none first:pt-1',
    icon: 'flex size-3.5 shrink-0 items-center justify-center',
    label: 'min-w-0',
    trailing: 'ml-auto shrink-0',
    content:
      'min-h-0 min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50'
  }
} as const
