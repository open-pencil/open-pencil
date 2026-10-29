export default {
  slots: {
    root: 'flex w-52 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border p-2',
    section: 'flex flex-col gap-0.5',
    heading: 'mb-1 flex items-center justify-between px-2',
    title: 'text-[11px] font-semibold text-muted',
    item: 'flex cursor-pointer items-center gap-2 rounded py-1 pr-2 pl-[calc(0.5rem+var(--depth,0)*0.75rem)] text-left text-xs text-surface hover:bg-hover data-[active]:bg-hover data-[active]:font-medium',
    groupLabel: 'truncate',
    count: 'ml-auto text-[11px] text-muted tabular-nums'
  }
} as const
