const figJamToolbarTheme = {
  slots: {
    bar: 'flex h-10 max-w-[calc(100vw-16px)] items-center gap-0.5 overflow-x-auto px-1',
    divider: 'mx-1 h-6 w-px shrink-0 bg-border',
    trigger:
      'flex h-8 shrink-0 cursor-pointer items-center gap-0.5 rounded-md px-1.5 text-muted outline-none hover:bg-hover hover:text-surface focus-visible:ring-2 focus-visible:ring-accent/50 data-[state=open]:bg-hover data-[state=open]:text-surface',
    triggerText: 'max-w-24 truncate text-xs text-surface',
    chevron: 'size-3 shrink-0',
    dot: 'size-4 shrink-0 rounded-full border border-border',
    popover: 'z-50 p-2',
    options: 'flex min-w-36 flex-col gap-0.5',
    option:
      'flex h-7 cursor-pointer items-center gap-2 rounded px-2 text-left text-xs text-surface outline-none hover:bg-hover focus-visible:bg-hover data-[state=on]:bg-accent/15 data-[state=on]:text-primary',
    optionIcon: 'size-4 shrink-0 text-muted',
    group: 'grid gap-2',
    groupLabel: 'text-[11px] text-muted',
    segments: 'flex gap-1'
  }
}

export type FigJamToolbarTheme = typeof figJamToolbarTheme
export default figJamToolbarTheme
