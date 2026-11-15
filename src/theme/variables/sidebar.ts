export default {
  slots: {
    root: 'flex w-52 shrink-0 flex-col gap-4 overflow-y-auto border-e border-border p-2',
    section: 'flex flex-col gap-0.5',
    heading: 'mb-1 flex items-center justify-between px-2',
    title: 'text-2xs font-semibold text-muted',
    item: 'flex cursor-pointer items-center gap-2 rounded py-1 pe-2 ps-[calc(0.5rem+var(--depth,0)*0.75rem)] text-start text-xs text-surface hover:bg-hover data-[active]:bg-hover data-[active]:font-medium',
    groupLabel: 'truncate',
    count: 'ms-auto text-2xs text-muted tabular-nums'
  }
} as const
