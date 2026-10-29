/** A side list of places, drawn like the Settings dialog's sections: groups split by rules, headings, 28px rows with icons. */
export default {
  slots: {
    root: 'flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-panel',
    group: 'flex flex-col gap-0.5 border-t border-border p-2 first:border-t-0',
    header: 'flex h-7 shrink-0 items-center justify-between pr-0.5 pl-2',
    title: 'text-[11px] font-semibold text-muted',
    actions: 'flex items-center gap-0.5',
    items: 'flex flex-col gap-0.5',
    item: 'group flex h-7 w-full shrink-0 cursor-pointer items-center gap-2 rounded border-none bg-transparent px-2 text-left text-xs text-muted outline-none transition-colors hover:bg-hover hover:text-surface focus-visible:ring-2 focus-visible:ring-accent/50 data-[active=true]:bg-hover data-[active=true]:text-surface',
    icon: 'size-3.5 shrink-0',
    label: 'min-w-0 flex-1 truncate',
    trailing: 'flex shrink-0 items-center gap-1.5 text-[11px] text-muted tabular-nums',
    attention: 'size-3.5 text-warning'
  }
} as const
